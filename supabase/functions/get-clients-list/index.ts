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
    console.log("[get-clients-list] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[get-clients-list] Unauthorized: No Authorization header")
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Use the client Supabase instance (with RLS) for auth
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      console.error("[get-clients-list] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[get-clients-list] User authenticated:", user.id)

    // Use service role client to fetch secrets securely
    const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)
    const { data: secrets, error: secretsError } = await serviceRoleSupabase
      .from('notion_secrets')
      .select('crm_database_id')
      .eq('id', user.id)
      .single()

    if (secretsError || !secrets || !secrets.crm_database_id) {
      console.error("[get-clients-list] Notion CRM database ID not configured or secrets fetch failed:", secretsError?.message)
      // Return 404 if configuration is missing
      return new Response(JSON.stringify({
        error: 'Notion CRM database ID not configured. Please configure your Notion credentials first.',
        errorCode: 'NOTION_CONFIG_NOT_FOUND'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch clients from the clients_mirror table. RLS handles filtering by user_id.
    const { data: clientsData, error: fetchError } = await supabase
      .from('clients_mirror')
      .select('id, name, focus, email, phone, star_sign')
      .order('name', { ascending: true });

    if (fetchError) {
      console.error("[get-clients-list] Database fetch error:", fetchError?.message)
      return new Response(JSON.stringify({ error: 'Failed to fetch clients from database', details: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-clients-list] Found", clientsData.length, "clients in clients_mirror")

    const clients = clientsData.map((client: any) => ({
      id: client.id,
      name: client.name,
      focus: client.focus || "",
      email: client.email || "",
      phone: client.phone || "",
      starSign: client.star_sign || "Unknown",
    }))

    if (clients.length === 0) {
        console.log("[get-clients-list] Clients mirror is empty. Returning empty list with specific error code.")
        // Return 404 Not Found to trigger client-side error handler which handles CLIENTS_MIRROR_EMPTY
        return new Response(JSON.stringify({ 
            error: 'No clients found in local database. Please run a Notion sync.',
            errorCode: 'CLIENTS_MIRROR_EMPTY',
            clients: []
        }), {
            status: 404, // Changed status to 404
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    return new Response(JSON.stringify({ clients }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[get-clients-list] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})