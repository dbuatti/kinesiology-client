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
    console.log("[get-all-clients] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[get-all-clients] Unauthorized: No Authorization header")
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
      console.error("[get-all-clients] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[get-all-clients] User authenticated:", user.id)

    const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: secrets, error: secretsError } = await serviceRoleSupabase
      .from('notion_secrets')
      .select('notion_integration_token, crm_database_id')
      .eq('user_id', user.id)
      .single()

    if (secretsError || !secrets || !secrets.crm_database_id) {
      console.error("[get-all-clients] Notion CRM database ID not found for user:", user.id, secretsError?.message)
      return new Response(JSON.stringify({
        error: 'Notion CRM database ID not configured. Please configure your Notion credentials first.'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-all-clients] CRM database ID loaded:", secrets.crm_database_id)

    // Query Notion API for all clients
    const notionClientsResponse = await fetch('https://api.notion.com/v1/databases/' + secrets.crm_database_id + '/query', {
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

    if (!notionClientsResponse.ok) {
      const errorText = await notionClientsResponse.text()
      console.error("[get-all-clients] Notion API (Clients) error:", errorText)
      return new Response(JSON.stringify({ error: 'Failed to fetch clients from Notion', details: errorText }), {
        status: notionClientsResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const notionClientsData = await notionClientsResponse.json()
    console.log("[get-all-clients] Found", notionClientsData.results.length, "clients")

    const clients = notionClientsData.results.map((page: any) => {
      const properties = page.properties
      return {
        id: page.id,
        name: properties.Name?.title?.[0]?.plain_text || "Unknown Client",
        focus: properties.Focus?.rich_text?.[0]?.plain_text || "",
        email: properties.Email?.email || "",
        phone: properties.Phone?.phone_number || "",
        starSign: properties["Star Sign"]?.select?.name || "Unknown",
      }
    })

    return new Response(JSON.stringify({ clients }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[get-all-clients] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})