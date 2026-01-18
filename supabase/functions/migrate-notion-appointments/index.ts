import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { retryFetch } from '../_shared/notionUtils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to normalize client names for matching
function normalizeClientName(name: string): string {
    if (!name) return '';
    let normalized = name.trim().toLowerCase();

    // 1. Remove common prefixes like numbers and dashes (e.g., "1 - ", "2 - ")
    normalized = normalized.replace(/^\d+\s*-\s*/, '');

    // 2. Remove common suffixes related to session details, dates, and time
    // This regex attempts to remove common session/date/time phrases at the end of the string
    normalized = normalized.replace(/\s*(\(|\s*kinesiology|\s*session|\s*checkup|\s*balance|\s*appointment|\s*follow up|\s*community|\s*discounted|\s*minutes|\s*hour|\s*hr|\s*january|\s*february|\s*march|\s*april|\s*may|\s*june|\s*july|\s*august|\s*september|\s*october|\s*november|\s*december|\s*jan|\s*feb|\s*mar|\s*apr|\s*jun|\s*jul|\s*aug|\s*sep|\s*oct|\s*nov|\s*dec|\s*\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{4}|\s*\d{4}|\s*,\s*\d{4}|\s*\d{1,2}\s*:\s*\d{2}|\s*am|\s*pm|\s*kinesiology|\s*session|\s*checkup|\s*balance|\s*appointment|\s*follow up|\s*community|\s*discounted|\s*minutes|\s*hour|\s*hr|\s*january|\s*february|\s*march|\s*april|\s*may|\s*june|\s*july|\s*august|\s*september|\s*october|\s*november|\s*december|\s*jan|\s*feb|\s*mar|\s*apr|\s*jun|\s*jul|\s*aug|\s*sep|\s*oct|\s*nov|\s*dec|\s*\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{4}|\s*\d{4}|\s*,\s*\d{4}|\s*\d{1,2}\s*:\s*\d{2}|\s*am|\s*pm|\s*)\s*$/ig, '');
    
    // Remove content in parentheses/brackets if they appear at the end after cleaning
    normalized = normalized.replace(/\s*\(.*\)\s*$/, ''); 
    normalized = normalized.replace(/\s*\[.*\]\s*$/, ''); 

    // Remove trailing commas or spaces
    normalized = normalized.replace(/,\s*$/, '').trim();

    // NEW STEP: Remove all non-alphanumeric characters (including spaces) for strict matching key
    // This ensures "D Hill", "D. Hill", and "Dhill" all become "dhill"
    normalized = normalized.replace(/[^a-z0-9]/g, ''); 

    return normalized;
}

// Helper function to fetch client name from Notion page ID
async function fetchClientName(clientPageId: string, notionToken: string): Promise<string | null> {
    try {
        const clientPageResponse = await retryFetch(`https://api.notion.com/v1/pages/${clientPageId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            }
        });

        if (!clientPageResponse.ok) {
            console.warn(`[migrate-notion-appointments] Failed to fetch client page ${clientPageId}: ${await clientPageResponse.text()}`);
            return null;
        }

        const clientPageData = await clientPageResponse.json();
        // Assuming the client name is in the 'Name' title property of the client page
        const clientName = clientPageData.properties.Name?.title?.[0]?.plain_text || null;
        
        if (!clientName) {
            console.warn(`[migrate-notion-appointments] Client name property not found on client page ${clientPageId}.`);
            return null;
        }
        return clientName;
    } catch (error) {
        console.error(`[migrate-notion-appointments] Error fetching client name for ${clientPageId}:`, error);
        return null;
    }
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

    // 2. Fetch local clients for mapping (Normalized Name -> ID, Email -> ID)
    const { data: clientsData, error: clientsError } = await serviceRoleSupabase
      .from('clients')
      .select('id, name, email')
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
      // Store normalized name -> ID mapping
      clientMap.set(normalizeClientName(client.name), client.id);
      // Store email -> ID mapping (if email exists)
      if (client.email) {
        // Apply strict normalization to email too, just in case
        clientMap.set(client.email.toLowerCase().replace(/[^a-z0-9]/g, ''), client.id);
      }
    });
    console.log(`[migrate-notion-appointments] Loaded ${clientMap.size} unique client mappings (names/emails).`);

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
      
      // 1. Determine Client Name/Identifier
      let rawClientName = properties['Client Name']?.title?.[0]?.plain_text || properties['Name']?.title?.[0]?.plain_text;
      const clientRelationId = properties.Client?.relation?.[0]?.id; // Check for relation named "Client"

      if (clientRelationId) {
          // If a relation ID is found, fetch the client name from the related page
          const fetchedName = await fetchClientName(clientRelationId, notionToken);
          if (fetchedName) {
              rawClientName = fetchedName;
              console.log(`[migrate-notion-appointments] Resolved client name via relation: ${rawClientName}`);
          } else if (!rawClientName) {
              // If relation failed and no name in title, we can't proceed
              console.warn(`[migrate-notion-appointments] Skipping appointment: Failed to resolve client name from relation ID ${clientRelationId} and no name in title.`);
              errors.push(`Skipped Notion page ${page.id}: Failed to resolve client name from relation ID ${clientRelationId}.`);
              skippedCount++;
              continue;
          }
      }

      const date = properties.Date?.date?.start;
      const goal = properties.Goal?.rich_text?.[0]?.plain_text || '';
      const sessionNorthStar = properties['Session North Star']?.rich_text?.[0]?.plain_text || '';
      const status = properties.Status?.select?.name || 'AP'; // Default to 'AP'
      const notes = properties.Notes?.rich_text?.[0]?.plain_text || '';
      const sessionAnchor = properties['Session Anchor']?.rich_text?.[0]?.plain_text || '';
      const priorityPattern = properties['Priority Pattern']?.select?.name || null;

      let missingFields = [];
      if (!rawClientName) missingFields.push('Client Name');
      if (!date) missingFields.push('Date');

      if (missingFields.length > 0) {
        console.warn(`[migrate-notion-appointments] Skipping appointment due to missing fields (${missingFields.join(', ')}): ${page.id}`);
        errors.push(`Skipped Notion page ${page.id}: Missing required fields (${missingFields.join(', ')}).`);
        skippedCount++;
        continue;
      }

      // Try to find client ID using strict normalization
      let clientId = null;
      const normalizedClientName = normalizeClientName(rawClientName);
      
      // Strategy 1: Exact match on strictly normalized name
      clientId = clientMap.get(normalizedClientName);
      
      if (!clientId) {
        console.warn(`[migrate-notion-appointments] Skipping appointment: Client name "${rawClientName}" (Normalized: ${normalizedClientName}) not found in local database.`);
        errors.push(`Client "${rawClientName}" (Normalized: ${normalizedClientName}) not found in local database.`);
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
          errors.push(`Error checking existing appointment for ${rawClientName} on ${date}: ${checkError.message}`);
          skippedCount++;
          continue;
      }

      if (existingCount && existingCount > 0) {
          console.log(`[migrate-notion-appointments] Skipping appointment: Duplicate found for ${rawClientName} on ${date}.`);
          errors.push(`Duplicate appointment found for ${rawClientName} on ${date}.`);
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
        console.error(`[migrate-notion-appointments] Insert error for ${rawClientName} on ${date}:`, insertError.message);
        errors.push(`Failed to insert appointment for ${rawClientName} on ${date}: ${insertError.message}`);
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