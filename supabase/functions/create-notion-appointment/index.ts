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
    console.log("[create-notion-appointment] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[create-notion-appointment] Unauthorized: No Authorization header")
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
      console.error("[create-notion-appointment] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[create-notion-appointment] User authenticated:", user.id)

    // Fetch Notion credentials from secure secrets table
    const { data: secrets, error: secretsError } = await supabase
      .from('notion_secrets')
      .select('notion_integration_token, appointments_database_id') // Removed crm_database_id
      .eq('id', user.id)
      .single()

    if (secretsError || !secrets || !secrets.appointments_database_id) {
      console.error("[create-notion-appointment] Notion configuration missing required IDs:", user.id, secretsError?.message)
      return new Response(JSON.stringify({
        error: 'Notion configuration missing Appointments database ID.'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { clientCrmId, clientName, date, goal, sessionNorthStar } = await req.json()

    if (!clientCrmId || !date || !goal || !clientName) {
      console.warn("[create-notion-appointment] Bad request: Missing required fields")
      return new Response(JSON.stringify({ error: 'Missing clientCrmId, date, clientName, or goal in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const notionPayload = {
      parent: {
        database_id: secrets.appointments_database_id,
      },
      properties: {
        // Name (Title property, usually client name + date)
        "Name": {
          title: [
            {
              text: {
                content: `${clientName} - ${date}`
              }
            }
          ]
        },
        // Date property
        "Date": {
          date: {
            start: date, // YYYY-MM-DD format
            end: null
          }
        },
        // Goal property (Rich Text)
        "Goal": {
          rich_text: [
            {
              text: {
                content: goal
              }
            }
          ]
        },
        // Session North Star property (Rich Text)
        "Session North Star": {
          rich_text: [
            {
              text: {
                content: sessionNorthStar
              }
            }
          ]
        },
        // Status property (Select/Status) - Default to 'AP' (Appointment)
        "Status": {
          status: {
            name: "AP"
          }
        },
        // Client relation property - clientCrmId is the Notion Page ID of the client
        "Client": {
          relation: [
            {
              id: clientCrmId
            }
          ]
        }
      }
    }

    console.log("[create-notion-appointment] Creating Notion page with payload...")

    const notionCreateResponse = await retryFetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secrets.notion_integration_token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(notionPayload)
    })

    if (!notionCreateResponse.ok) {
      const errorText = await notionCreateResponse.text()
      console.error("[create-notion-appointment] Notion API (Create Page) error:", errorText)
      return new Response(JSON.stringify({ error: 'Failed to create Notion appointment', details: errorText }), {
        status: notionCreateResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const newPage = await notionCreateResponse.json()
    console.log("[create-notion-appointment] Notion page created successfully:", newPage.id)

    return new Response(JSON.stringify({ success: true, newAppointmentId: newPage.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[create-notion-appointment] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})