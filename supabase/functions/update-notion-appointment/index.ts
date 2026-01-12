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
      .eq('user_id', user.id)
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
    const { appointmentId, updates } = await req.json();

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

    if (updates.sessionAnchor !== undefined) {
      notionProperties["Today we are really working with..."] = {
        rich_text: [{ type: "text", text: { content: updates.sessionAnchor } }]
      };
    }
    // Removed BODY YES and BODY NO update logic
    if (updates.status !== undefined) {
      // Corrected: Use 'status' key for Notion status property
      notionProperties["Status"] = { status: { name: updates.status } };
    }
    if (updates.goal !== undefined) {
      notionProperties["Goal"] = {
        rich_text: [{ type: "text", text: { content: updates.goal } }]
      };
    }
    if (updates.priorityPattern !== undefined) {
      notionProperties["Priority Pattern"] = updates.priorityPattern ? { select: { name: updates.priorityPattern } } : { select: null };
    }
    if (updates.notes !== undefined) {
      notionProperties["Notes"] = {
        rich_text: [{ type: "text", text: { content: updates.notes } }]
      };
    }
    if (updates.sessionNorthStar !== undefined) { // New: Add Session North Star update
      notionProperties["Session North Star"] = {
        rich_text: [{ type: "text", text: { content: updates.sessionNorthStar } }]
      };
    }

    console.log("[update-notion-appointment] Updating Notion page:", appointmentId, "with properties:", notionProperties)

    const notionUpdateResponse = await fetch('https://api.notion.com/v1/pages/' + appointmentId, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${secrets.notion_integration_token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28' // Corrected Notion API version
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