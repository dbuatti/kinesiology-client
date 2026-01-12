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
        console.log("[get-notion-modes] Starting function execution")

        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
          console.warn("[get-notion-modes] Unauthorized: No Authorization header")
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
          console.error("[get-notion-modes] User authentication failed:", userError?.message)
          return new Response('Unauthorized', {
            status: 401,
            headers: corsHeaders
          })
        }

        console.log("[get-notion-modes] User authenticated:", user.id)

        const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

        const { data: secrets, error: secretsError } = await serviceRoleSupabase
          .from('notion_secrets')
          .select('notion_integration_token, modes_database_id')
          .eq('id', user.id) // Changed from 'user_id' to 'id'
          .single()

        if (secretsError || !secrets || !secrets.modes_database_id) {
          console.error("[get-notion-modes] Modes database ID not found for user:", user.id, secretsError?.message)
          return new Response(JSON.stringify({
            error: 'Notion Modes & Balances database ID not configured.'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        console.log("[get-notion-modes] Modes database ID loaded:", secrets.modes_database_id)

        const notionModesResponse = await fetch('https://api.notion.com/v1/databases/' + secrets.modes_database_id + '/query', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${secrets.notion_integration_token}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          },
          body: JSON.stringify({
            sorts: [
              {
                property: "Name",
                direction: "ascending"
              }
            ]
          })
        })

        if (!notionModesResponse.ok) {
          const errorText = await notionModesResponse.text()
          console.error("[get-notion-modes] Notion API (Modes) error:", errorText)
          return new Response(JSON.stringify({ error: 'Failed to fetch modes from Notion', details: errorText }), {
            status: notionModesResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const notionModesData = await notionModesResponse.json()
        console.log("[get-notion-modes] Found", notionModesData.results.length, "modes")

        const modes = notionModesData.results.map((page: any) => {
          const properties = page.properties
          return {
            id: page.id,
            name: properties.Name?.title?.[0]?.plain_text || "Unknown Mode",
            actionNote: properties["Action Note"]?.rich_text?.[0]?.plain_text || "",
          }
        })

        return new Response(JSON.stringify({ modes }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      } catch (error) {
        console.error("[get-notion-modes] Unexpected error:", error?.message)
        return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    })