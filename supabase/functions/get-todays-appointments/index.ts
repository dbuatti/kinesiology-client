// @ts-nocheck
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
    // Get the user from the auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Verify the user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    console.log("[get-todays-appointments] User authenticated:", user.id)

    // Fetch Notion configuration
    const { data: config, error: configError } = await supabase
      .from('notion_config')
      .select('integration_token, appointments_database_id')
      .eq('user_id', user.id)
      .single()

    if (configError || !config) {
      console.error("[get-todays-appointments] Config error:", configError)
      return new Response(JSON.stringify({ error: 'Notion configuration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-todays-appointments] Config loaded successfully")

    // Get today's date in Notion format (YYYY-MM-DD)
    const today = new Date()
    const todayString = today.toISOString().split('T')[0]

    // Query Notion API
    const notionResponse = await fetch('https://api.notion.com/v1/databases/' + config.appointments_database_id + '/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.integration_token}`,
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
              status: {
                does_not_equal: "Closed"
              }
            }
          ]
        }
      })
    })

    if (!notionResponse.ok) {
      const errorText = await notionResponse.text()
      console.error("[get-todays-appointments] Notion API error:", errorText)
      return new Response(JSON.stringify({ error: 'Failed to fetch from Notion', details: errorText }), {
        status: notionResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const notionData = await notionResponse.json()
    console.log("[get-todays-appointments] Found", notionData.results.length, "appointments")

    // Process and return the appointments
    const appointments = notionData.results.map((page: any) => {
      const properties = page.properties
      
      // Extract Client Name from CRM relation
      const clientName = properties.Client?.relation?.[0]?.id || 
                        properties["Client Name"]?.title?.[0]?.plain_text || 
                        "Unknown Client"
      
      // Extract Star Sign
      const starSign = properties["Star Sign"]?.select?.name || "Unknown"
      
      // Extract Goal
      const goal = properties.Goal?.rich_text?.[0]?.plain_text || ""

      return {
        id: page.id,
        clientName,
        starSign,
        goal
      }
    })

    return new Response(JSON.stringify({ appointments }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[get-todays-appointments] Error:", error)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})