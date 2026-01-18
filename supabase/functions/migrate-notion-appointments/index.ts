import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { retryFetch } from '../_shared/notionUtils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("[migrate-notion-appointments] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[migrate-notion-appointments] Unauthorized: No Authorization header")
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    const authSupabase = createClient(supabaseUrl, supabaseAnonKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await authSupabase.auth.getUser(token)

    if (userError || !user) {
      console.error("[migrate-notion-appointments] User authentication failed:", userError?.message)
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    console.log("[migrate-notion-appointments] User authenticated:", user.id)

    const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // 1. Fetch Notion credentials
    const { data: secrets, error: secretsError } = await serviceRoleSupabase
      .from('notion_secrets')
      .select('notion_integration_token, appointments_database_id')
      .eq('id', user.id)
      .single()

    if (secretsError || !secrets || !secrets.appointments_database_id) {
      console.error("[migrate-notion-appointments] Notion Appointments database ID not configured.")
      return new Response(JSON.stringify({
        error: 'Notion Appointments database ID not configured.',
        errorCode: 'NOTION_CONFIG_NOT_FOUND'
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    
    const notionToken = secrets.notion_integration_token;
    const appointmentsDbId = secrets.appointments_database_id;

    // 2. Fetch local clients for mapping (Name -> ID)
    const { data: clientsData, error: clientsError } = await serviceRoleSupabase
      .from('clients')
      .select('id, name')
      .eq('user_id', user.id);

    if (clientsError) {
      console.error("[migrate-notion-appointments] Error fetching local clients:", clientsError.message)
      return new Response(JSON.stringify({ error: 'Failed to fetch local clients for mapping.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const clientMap = new Map<string, string>();
    clientsData.forEach(client => {
      clientMap.set(client.name.toLowerCase(), client.id);
    });
    console.log(`[migrate-notion-appointments] Loaded ${clientMap.size} local clients for mapping.`);

    // 3. Query Notion for appointments (up to 100 for simplicity)
    const notionResponse = await retryFetch(`https://api.notion.com/v1/databases/${appointmentsDbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        page_size: 100,
        sorts: [{ property: "Date", direction: "descending" }]
      })
    });

    if (!notionResponse.ok) {
      const errorText = await notionResponse.text()
      console.error("[migrate-notion-appointments] Notion API (Appointments) error:", errorText)
      return new Response(JSON.stringify({ error: 'Failed to query Notion Appointments database', details: errorText }), {
        status: notionResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const notionData = await notionResponse.json()
    const notionAppointments = notionData.results;
    console.log(`[migrate-notion-appointments] Found ${notionAppointments.length} Notion appointments.`);

    let migratedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // 4. Process and migrate appointments
    for (const page of notionAppointments) {
      const properties = page.properties;
      
      // Assuming 'Client Name' is the Title property, or 'Name'
      const clientName = properties['Client Name']?.title?.[0]?.plain_text || properties['Name']?.title?.[0]?.plain_text;
      const date = properties.Date?.date?.start;
      const goal = properties.Goal?.rich_text?.[0]?.plain_text || '';
      const sessionNorthStar = properties['Session North Star']?.rich_text?.[0]?.plain_text || '';
      const status = properties.Status?.select?.name || 'AP'; // Default to 'AP'
      const notes = properties.Notes?.rich_text?.[0]?.plain_text || '';
      const sessionAnchor = properties['Session Anchor']?.rich_text?.[0]?.plain_text || '';
      const priorityPattern = properties['Priority Pattern']?.select?.name || null;

      if (!clientName || !date) {
        console.warn(`[migrate-notion-appointments] Skipping appointment due to missing Client Name or Date: ${page.id}`);
        skippedCount++;
        continue;
      }

      const clientId = clientMap.get(clientName.toLowerCase());

      if (!clientId) {
        console.warn(`[migrate-notion-appointments] Skipping appointment: Client "${clientName}" not found in local database.`);
        errors.push(`Client "${clientName}" not found in local database.`);
        skippedCount++;
        continue;
      }

      // Check if an appointment with the same client_id and date already exists (simple deduplication)
      const { count: existingCount, error: checkError } = await serviceRoleSupabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('client_id', clientId)
        .eq('date', date);
        
      if (checkError) {
          console.error(`[migrate-notion-appointments] Error checking existing appointment: ${checkError.message}`);
          errors.push(`Error checking existing appointment for ${clientName} on ${date}: ${checkError.message}`);
          skippedCount++;
          continue;
      }

      if (existingCount && existingCount > 0) {
          console.log(`[migrate-notion-appointments] Skipping appointment: Duplicate found for ${clientName} on ${date}.`);
          errors.push(`Duplicate appointment found for ${clientName} on ${date}.`);
          skippedCount++;
          continue;
      }

      // Insert into Supabase appointments table
      const { error: insertError } = await serviceRoleSupabase
        .from('appointments')
        .insert({
          user_id: user.id,
          client_id: clientId,
          date: date,
          goal: goal,
          session_north_star: sessionNorthStar,
          priority_pattern: priorityPattern,
          status: status,
          notes: notes,
          session_anchor: sessionAnchor,
        });

      if (insertError) {
        console.error(`[migrate-notion-appointments] Insert error for ${clientName} on ${date}:`, insertError.message);
        errors.push(`Failed to insert appointment for ${clientName} on ${date}: ${insertError.message}`);
        skippedCount++;
      } else {
        migratedCount++;
      }
    }

    console.log(`[migrate-notion-appointments] Migration finished. Migrated: ${migratedCount}, Skipped: ${skippedCount}`);

    return new Response(JSON.stringify({ 
      success: true, 
      migratedCount, 
      skippedCount, 
      errors 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[migrate-notion-appointments] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})