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
    console.log("[get-todays-appointments] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[get-todays-appointments] Unauthorized: No Authorization header")
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Create a Supabase client for authentication (using anon key is fine for auth.getUser)
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey)

    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: userError } = await authSupabase.auth.getUser(token)

    if (userError || !user) {
      console.error("[get-todays-appointments] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[get-todays-appointments] User authenticated:", user.id)

    // Use service role key to fetch secrets securely, bypassing RLS if necessary
    const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Fetch user profile to get practitioner name
    const { data: profilesData, error: profileError } = await serviceRoleSupabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .limit(1); // Use limit(1) instead of single() for robustness

    if (profileError) {
      console.error("[get-todays-appointments] Profile fetch error:", user.id, profileError?.message);
      return new Response(JSON.stringify({
        error: 'Failed to fetch user profile.',
        details: profileError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const profile = profilesData?.[0]; // Get the first profile if available

    if (!profile) {
        console.error("[get-todays-appointments] Profile data is missing for user:", user.id);
        return new Response(JSON.stringify({
            error: 'User profile not found. Please set up your profile.',
            errorCode: 'PROFILE_NOT_FOUND'
        }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const practitionerName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    if (!practitionerName) {
      console.warn("[get-todays-appointments] Practitioner name is empty for user:", user.id);
      return new Response(JSON.stringify({
        error: 'Practitioner name not found in profile. Please update your profile.',
        errorCode: 'PRACTITIONER_NAME_MISSING'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log("[get-todays-appointments] Practitioner name:", practitionerName);

    // Fetch Notion credentials from secure secrets table
    const { data: secrets, error: secretsError } = await serviceRoleSupabase
      .from('notion_secrets')
      .select('notion_integration_token, appointments_database_id, crm_database_id')
      .eq('user_id', user.id)
      .single()

    if (secretsError || !secrets) {
      console.error("[get-todays-appointments] Secrets not found for user:", user.id, secretsError?.message)
      return new Response(JSON.stringify({
        error: 'Notion configuration not found. Please configure your Notion credentials first.'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-todays-appointments] Secrets loaded successfully for user:", user.id)

    // Get today's date in Notion format (YYYY-MM-DD)
    const today = new Date()
    const todayString = today.toISOString().split('T')[0]

    // Query Notion API for today's appointments
    const notionAppointmentsResponse = await fetch('https://api.notion.com/v1/databases/' + secrets.appointments_database_id + '/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secrets.notion_integration_token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        filter: {
          and: [
            {
              property: "Date",
              date: {
                equals: todayString
              }
            },
            {
              property: "Status",
              status: { // Changed from 'select' to 'status'
                equals: "OPEN" // Filter for OPEN status
              }
            },
            {
              property: "Practitioner", // Filter by Practitioner
              select: { // Assuming Practitioner is a Select property
                equals: practitionerName
              }
            }
          ]
        }
      })
    })

    if (!notionAppointmentsResponse.ok) {
      const errorText = await notionAppointmentsResponse.text()
      console.error("[get-todays-appointments] Notion API (Appointments) error:", errorText)
      return new Response(JSON.stringify({ error: 'Failed to fetch appointments from Notion', details: errorText }), {
        status: notionAppointmentsResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const notionAppointmentsData = await notionAppointmentsResponse.json()
    console.log("[get-todays-appointments] Found", notionAppointmentsData.results.length, "appointments")

    const appointments = await Promise.all(notionAppointmentsData.results.map(async (page: any) => {
      const properties = page.properties

      let clientName = properties.Name?.title?.[0]?.plain_text || "Unknown Client"
      let starSign = "Unknown" // Renamed from clientStarSign
      let focus = "" // Renamed from clientFocus

      // Fetch client details from CRM if relation exists and crm_database_id is available
      const clientCrmRelation = properties["Client CRM"]?.relation?.[0]?.id
      if (clientCrmRelation && secrets.crm_database_id) {
        console.log(`[get-todays-appointments] Fetching CRM details for client ID: ${clientCrmRelation}`)
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
          starSign = clientProperties["Star Sign"]?.select?.name || "Unknown"
          focus = clientProperties.Focus?.rich_text?.[0]?.plain_text || ""
          console.log(`[get-todays-appointments] CRM details fetched for ${clientName}`)
        } else {
          const errorText = await notionClientResponse.text()
          console.warn(`[get-todays-appointments] Failed to fetch CRM details for client ID ${clientCrmRelation}:`, errorText)
        }
      } else {
        console.log("[get-todays-appointments] No Client CRM relation or CRM database ID available.")
      }

      // Extract Goal from appointment
      const goal = properties.Goal?.rich_text?.[0]?.plain_text || ""
      const sessionAnchor = properties["Today we are really working with..."]?.rich_text?.[0]?.plain_text || "" // New field
      const bodyYes = properties["BODY YES"]?.checkbox || false; // New field
      const bodyNo = properties["BODY NO"]?.checkbox || false; // New field
      const notionPageId = page.id; // Notion page ID for updating

      return {
        id: notionPageId, // Use Notion page ID as the appointment ID
        clientName,
        starSign,
        focus,
        goal,
        sessionAnchor,
        bodyYes,
        bodyNo,
      }
    }))

    return new Response(JSON.stringify({ appointments }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[get-todays-appointments] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})