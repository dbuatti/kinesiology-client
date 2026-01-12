import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("[update-notion-appointment] Starting function execution")
    console.log("[update-notion-appointment] Request method:", req.method);
    console.log("[update-notion-appointment] Request headers:", JSON.stringify(Object.fromEntries(req.headers.entries())));

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[update-notion-appointment] Unauthorized: No Authorization header")
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      console.error("[update-notion-appointment] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[update-notion-appointment] User authenticated:", user.id)

    // Fetch Notion credentials from secure secrets table
    const { data: secretsData, error: secretsError } = await supabase
      .from('notion_secrets')
      .select('notion_integration_token, appointments_database_id')
      .eq('id', user.id) // Changed from 'user_id' to 'id'
      .single()

    if (secretsError) {
      console.error("[update-notion-appointment] Secrets fetch error:", user.id, secretsError?.message)
      return new Response(JSON.stringify({
        error: 'Failed to fetch Notion configuration.',
        details: secretsError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const secrets = secretsData; // `single()` returns the object directly or null

    if (!secrets || !secrets.appointments_database_id) {
      console.error("[update-notion-appointment] Notion configuration not found for user:", user.id)
      return new Response(JSON.stringify({
        error: 'Notion configuration not found. Please configure your Notion credentials first.'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[update-notion-appointment] Secrets loaded successfully for user:", user.id)

    // Use req.json() directly for parsing the request body
    const requestBody = await req.json();
    console.log("[update-notion-appointment] Raw request body received:", JSON.stringify(requestBody));

    const appointmentId = requestBody.appointmentId;
    const updates = requestBody.updates;

    console.log("[update-notion-appointment] Parsed appointmentId:", appointmentId);
    console.log("[update-notion-appointment] Parsed updates:", updates);

    if (!appointmentId || !updates) {
      console.warn("[update-notion-appointment] Bad request: Missing appointmentId or updates. appointmentId:", appointmentId, "updates:", updates)
      return new Response(JSON.stringify({
        error: 'Missing appointmentId or updates in request body',
        receivedAppointmentId: appointmentId,
        receivedUpdates: updates
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const notionProperties: { [key: string]: any } = {};

    // Fetch the current Notion page to check for existing properties
    const currentAppointmentResponse = await fetch('https://api.notion.com/v1/pages/' + appointmentId, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secrets.notion_integration_token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      }
    });

    if (!currentAppointmentResponse.ok) {
      const errorText = await currentAppointmentResponse.text();
      console.error("[update-notion-appointment] Failed to fetch current appointment page:", errorText);
      throw new Error('Failed to fetch current appointment page to check properties.');
    }
    const currentAppointmentData = await currentAppointmentResponse.json();
    const existingNotionProperties = currentAppointmentData.properties;
    console.log("[update-notion-appointment] Existing Notion properties:", JSON.stringify(existingNotionProperties, null, 2));


    const updateProperty = (propertyName: string, notionKey: string, value: any, type: 'rich_text' | 'status' | 'select' | 'relation') => {
      if (existingNotionProperties[notionKey]) {
        console.log(`[update-notion-appointment] Property '${notionKey}' exists. Attempting to update.`);
        if (value !== undefined) {
          if (type === 'rich_text') {
            notionProperties[notionKey] = { rich_text: [{ type: "text", text: { content: value } }] };
          } else if (type === 'status') {
            notionProperties[notionKey] = value ? { status: { name: value } } : { status: null };
          } else if (type === 'select') {
            notionProperties[notionKey] = value ? { select: { name: value } } : { select: null };
          } else if (type === 'relation') {
            // Special handling for relations: append to existing
            const currentRelations = existingNotionProperties[notionKey]?.relation || [];
            const newRelations = [...currentRelations, { id: value }];
            notionProperties[notionKey] = { relation: newRelations };
          }
        }
      } else {
        console.warn(`[update-notion-appointment] Notion property '${notionKey}' does not exist in the database. Skipping update for ${propertyName}.`);
      }
    };

    updateProperty("sessionAnchor", "Today we are really working with...", updates.sessionAnchor, 'rich_text');
    updateProperty("status", "Status", updates.status, 'status');
    updateProperty("goal", "Goal", updates.goal, 'rich_text');
    updateProperty("priorityPattern", "Priority Pattern", updates.priorityPattern, 'select');
    updateProperty("notes", "Notes", updates.notes, 'rich_text');
    updateProperty("sessionNorthStar", "Session North Star", updates.sessionNorthStar, 'rich_text');
    
    if (updates.acupointId !== undefined) {
      updateProperty("acupointId", "Acupoints", updates.acupointId, 'relation');
    }

    console.log("[update-notion-appointment] Updating Notion page:", appointmentId, "with properties:", notionProperties)

    const notionUpdateResponse = await fetch('https://api.notion.com/v1/pages/' + appointmentId, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${secrets.notion_integration_token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        properties: notionProperties
      })
    })

    if (!notionUpdateResponse.ok) {
      const errorText = await notionUpdateResponse.text()
      console.error("[update-notion-appointment] Notion API (Update) error:", errorText)
      return new Response(JSON.stringify({ error: 'Failed to update Notion appointment', details: errorText }), {
        status: notionUpdateResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const updatedPage = await notionUpdateResponse.json()
    console.log("[update-notion-appointment] Notion page updated successfully:", updatedPage.id)

    return new Response(JSON.stringify({ success: true, updatedPageId: updatedPage.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error("[update-notion-appointment] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})