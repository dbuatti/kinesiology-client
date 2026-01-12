/// <reference path="../_shared/starSignCalculator.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { calculateStarSign } from '../_shared/starSignCalculator.ts'; // Import the new utility

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("[get-single-appointment] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[get-single-appointment] Unauthorized: No Authorization header")
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    const authSupabase = createClient(supabaseUrl, supabaseAnonKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await authSupabase.auth.getUser(token)

    if (userError || !user) {
      console.error("[get-single-appointment] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[get-single-appointment] User authenticated:", user.id)

    const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: secretsData, error: secretsError } = await serviceRoleSupabase
      .from('notion_secrets')
      .select('notion_integration_token, appointments_database_id, crm_database_id, muscles_database_id, channels_database_id, chakras_database_id') // Added chakras_database_id
      .eq('id', user.id) // Changed from 'user_id' to 'id'
      .limit(1);

    if (secretsError) {
      console.error("[get-single-appointment] Secrets fetch error:", user.id, secretsError?.message)
      return new Response(JSON.stringify({
        error: 'Failed to fetch Notion configuration.',
        details: secretsError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const secrets = secretsData?.[0]; // Extract the single object from the array

    if (!secrets) {
      console.error("[get-single-appointment] Secrets not found for user:", user.id)
      return new Response(JSON.stringify({
        error: 'Notion configuration not found. Please configure your Notion credentials first.'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-single-appointment] Secrets loaded successfully for user:", user.id)

    const { appointmentId } = await req.json();

    if (!appointmentId) {
      console.warn("[get-single-appointment] Bad request: Missing appointmentId")
      return new Response(JSON.stringify({ error: 'Missing appointmentId in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Query Notion API for the specific appointment page
    const notionAppointmentResponse = await fetch('https://api.notion.com/v1/pages/' + appointmentId, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secrets.notion_integration_token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      }
    })

    if (!notionAppointmentResponse.ok) {
      const errorText = await notionAppointmentResponse.text()
      console.error("[get-single-appointment] Notion API (Page) error:", errorText)
      return new Response(JSON.stringify({ error: 'Failed to fetch appointment from Notion', details: errorText }), {
        status: notionAppointmentResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const page = await notionAppointmentResponse.json()
    console.log("[get-single-appointment] Found appointment page:", page.id)

    const properties = page.properties

    let clientName = properties.Name?.title?.[0]?.plain_text || "Unknown Client"
    let starSign = "Unknown" // Initial value
    console.log("[get-single-appointment] Initial starSign:", starSign);

    // Fetch client details from CRM if relation exists and crm_database_id is available
    const clientCrmRelation = properties["Client CRM"]?.relation?.[0]?.id
    console.log("[get-single-appointment] Client CRM Relation ID:", clientCrmRelation);
    console.log("[get-single-appointment] CRM Database ID configured:", !!secrets.crm_database_id);

    if (clientCrmRelation && secrets.crm_database_id) {
      console.log(`[get-single-appointment] Attempting to fetch CRM details for client ID: ${clientCrmRelation}`)
      const notionClientResponse = await fetch('https://api.notion.com/v1/pages/' + clientCrmRelation, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${secrets.notion_integration_token}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        }
      })

      if (notionClientResponse.ok) {
        const clientData = await notionClientResponse.json()
        const clientProperties = clientData.properties

        clientName = clientProperties.Name?.title?.[0]?.plain_text || clientName
        const birthDate = clientProperties["Born"]?.date?.start || null; // Fetch 'Born' date
        console.log(`[get-single-appointment] Raw birthDate from CRM for ${clientName}:`, birthDate); // DIAGNOSTIC LOG
        starSign = calculateStarSign(birthDate); // Calculate star sign
        console.log(`[get-single-appointment] CRM details fetched for ${clientName}, starSign calculated: ${starSign}`)
      } else {
        const errorText = await notionClientResponse.text()
        console.warn(`[get-single-appointment] Failed to fetch CRM details for client ID ${clientCrmRelation}:`, errorText)
      }
    } else {
      console.log("[get-single-appointment] No Client CRM relation or CRM database ID available, or CRM not configured. Star sign remains 'Unknown'.")
    }

    const appointment = {
      id: page.id,
      clientName,
      starSign,
      sessionNorthStar: properties["Session North Star"]?.rich_text?.[0]?.plain_text || "", // New: Fetch Session North Star from appointment
      goal: properties.Goal?.rich_text?.[0]?.plain_text || "",
      sessionAnchor: properties["Today we are really working with..."]?.rich_text?.[0]?.plain_text || "",
      status: properties.Status?.status?.name || "UNKNOWN" // Get status for display
    }

    return new Response(JSON.stringify({ appointment }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[get-single-appointment] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})