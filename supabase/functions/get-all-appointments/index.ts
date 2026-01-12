/// <reference path="../_shared/starSignCalculator.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { calculateStarSign } from '../_shared/starSignCalculator.ts'; // Import the new utility
import { retryFetch } from '../_shared/notionUtils.ts'; // Import the shared utility

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("[get-all-appointments] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[get-all-appointments] Unauthorized: No Authorization header")
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
      console.error("[get-all-appointments] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[get-all-appointments] User authenticated:", user.id)

    const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: secrets, error: secretsError } = await serviceRoleSupabase
      .from('notion_secrets')
      .select('notion_integration_token, appointments_database_id, crm_database_id, modes_database_id, acupoints_database_id, muscles_database_id, channels_database_id, chakras_database_id') // Fetch all new IDs
      .eq('id', user.id)
      .single()

    if (secretsError || !secrets || !secrets.appointments_database_id) {
      console.error("[get-all-appointments] Notion configuration not found for user:", user.id, secretsError?.message)
      return new Response(JSON.stringify({
        error: 'Notion configuration not found. Please configure your Notion credentials first.'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-all-appointments] Secrets loaded successfully for user:", user.id)

    // Query Notion API for all appointments
    const notionAppointmentsResponse = await retryFetch('https://api.notion.com/v1/databases/' + secrets.appointments_database_id + '/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secrets.notion_integration_token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        sorts: [
          {
            property: "Date",
            direction: "descending"
          }
        ]
      })
    })

    if (!notionAppointmentsResponse.ok) {
      const errorText = await notionAppointmentsResponse.text()
      console.error("[get-all-appointments] Notion API (Appointments) error:", errorText)
      return new Response(JSON.stringify({ error: 'Failed to fetch appointments from Notion', details: errorText }), {
        status: notionAppointmentsResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const notionAppointmentsData = await notionAppointmentsResponse.json()
    console.log("[get-all-appointments] Found", notionAppointmentsData.results.length, "appointments")

    const appointments = await Promise.all(notionAppointmentsData.results.map(async (page: any) => {
      const properties = page.properties

      let clientName = properties.Name?.title?.[0]?.plain_text || "Unknown Client"
      let starSign = "Unknown"
      let clientEmail = ""
      let clientPhone = ""
      let clientFocus = "" // Renamed from 'focus' to 'clientFocus' for clarity

      // Fetch client details from CRM if relation exists and crm_database_id is available
      // Use the 'Client' relation property from the appointment page to link to the client in CRM
      const clientCrmRelation = properties["Client"]?.relation?.[0]?.id
      if (clientCrmRelation && secrets.crm_database_id) {
        console.log(`[get-all-appointments] Fetching CRM details for client ID: ${clientCrmRelation}`)
        const notionClientResponse = await retryFetch('https://api.notion.com/v1/pages/' + clientCrmRelation, {
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
          // Read star sign directly from the rollup property on the appointment page
          starSign = properties["Star Sign"]?.rollup?.array?.[0]?.formula?.string || "Unknown";
          clientFocus = clientProperties.Focus?.rich_text?.[0]?.plain_text || "" // Fetch general client focus
          clientEmail = clientProperties.Email?.email || ""
          clientPhone = clientProperties.Phone?.phone_number || ""
          console.log(`[get-all-appointments] CRM details fetched for ${clientName}`)
        } else {
          const errorText = await notionClientResponse.text()
          console.warn(`[get-all-appointments] Failed to fetch CRM details for client ID ${clientCrmRelation}:`, errorText)
        }
      } else {
        console.log("[get-all-appointments] No Client CRM relation or CRM database ID available.")
      }

      const notionPageId = page.id;

      return {
        id: notionPageId,
        clientName,
        clientCrmId: clientCrmRelation, // Include CRM page ID for potential direct client updates
        starSign,
        clientFocus, // General client focus
        sessionNorthStar: properties["Session North Star"]?.rich_text?.[0]?.plain_text || "", // New: Fetch Session North Star from appointment
        clientEmail,
        clientPhone,
        date: properties.Date?.date?.start || null,
        goal: properties.Goal?.rich_text?.[0]?.plain_text || "",
        priorityPattern: properties["Priority Pattern"]?.select?.name || null,
        status: properties.Status?.select?.name || "OPEN",
        notes: properties.Notes?.rich_text?.[0]?.plain_text || "",
        sessionAnchor: properties["Today we are really working with..."]?.rich_text?.[0]?.plain_text || "",
        bodyYes: properties["BODY YES"]?.checkbox || false,
        bodyNo: properties["BODY NO"]?.checkbox || false,
      }
    }))

    return new Response(JSON.stringify({ appointments }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[get-all-appointments] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})