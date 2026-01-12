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

        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
          console.warn("[update-notion-appointment] Unauthorized: No Authorization header")
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
          console.error("[update-notion-appointment] User authentication failed:", userError?.message)
          return new Response('Unauthorized', {
            status: 401,
            headers: corsHeaders
          })
        }

        console.log("[update-notion-appointment] User authenticated:", user.id)

        const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

        const { data: secrets, error: secretsError } = await serviceRoleSupabase
          .from('notion_secrets')
          .select('notion_integration_token, appointments_database_id')
          .eq('user_id', user.id)
          .single()

        if (secretsError || !secrets || !secrets.appointments_database_id) {
          console.error("[update-notion-appointment] Appointments database ID not found for user:", user.id, secretsError?.message)
          return new Response(JSON.stringify({
            error: 'Notion Appointments database ID not configured.'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        console.log("[update-notion-appointment] Appointments database ID loaded:", secrets.appointments_database_id)

        const { appointmentId, updates } = await req.json()

        if (!appointmentId || !updates) {
          console.warn("[update-notion-appointment] Bad request: Missing appointmentId or updates")
          return new Response(JSON.stringify({ error: 'Missing appointmentId or updates in request body' }), {
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
        if (updates.bodyYes !== undefined) {
          notionProperties["BODY YES"] = { checkbox: updates.bodyYes };
        }
        if (updates.bodyNo !== undefined) {
          notionProperties["BODY NO"] = { checkbox: updates.bodyNo };
        }
        if (updates.status !== undefined) {
          notionProperties["Status"] = { select: { name: updates.status } };
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

      } catch (error) {
        console.error("[update-notion-appointment] Unexpected error:", error?.message)
        return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    })