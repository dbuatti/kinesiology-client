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
    console.log("[update-notion-client] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[update-notion-client] Unauthorized: No Authorization header")
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
      console.error("[update-notion-client] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[update-notion-client] User authenticated:", user.id)

    const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: secrets, error: secretsError } = await serviceRoleSupabase
      .from('notion_secrets')
      .select('notion_integration_token, crm_database_id')
      .eq('user_id', user.id)
      .single()

    if (secretsError || !secrets || !secrets.crm_database_id) {
      console.error("[update-notion-client] Notion CRM database ID not found for user:", user.id, secretsError?.message)
      return new Response(JSON.stringify({
        error: 'Notion CRM database ID not configured. Please configure your Notion credentials first.'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[update-notion-client] CRM database ID loaded:", secrets.crm_database_id)

    const { clientId, updates } = await req.json()

    if (!clientId || !updates) {
      console.warn("[update-notion-client] Bad request: Missing clientId or updates")
      return new Response(JSON.stringify({ error: 'Missing clientId or updates in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const notionProperties: { [key: string]: any } = {};

    if (updates.focus !== undefined) {
      notionProperties["Focus"] = {
        rich_text: [{ type: "text", text: { content: updates.focus } }]
      };
    }
    if (updates.email !== undefined) {
      notionProperties["Email"] = { email: updates.email };
    }
    if (updates.phone !== undefined) {
      notionProperties["Phone"] = { phone_number: updates.phone };
    }

    console.log("[update-notion-client] Updating Notion page:", clientId, "with properties:", notionProperties)

    const notionUpdateResponse = await fetch('https://api.notion.com/v1/pages/' + clientId, {
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
      console.error("[update-notion-client] Notion API (Update) error:", errorText)
      return new Response(JSON.stringify({ error: 'Failed to update Notion client', details: errorText }), {
        status: notionUpdateResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const updatedPage = await notionUpdateResponse.json()
    console.log("[update-notion-client] Notion page updated successfully:", updatedPage.id)

    return new Response(JSON.stringify({ success: true, updatedPageId: updatedPage.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[update-notion-client] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})