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

    // Use the client Supabase instance (with RLS) for auth
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      console.error("[get-all-clients] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[get-all-clients] User authenticated:", user.id)

    // Use service role client to fetch secrets securely
    const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)
    const { data: secrets, error: secretsError } = await serviceRoleSupabase
      .from('notion_secrets')
      .select('crm_database_id')
      .eq('id', user.id)
      .single()

    if (secretsError || !secrets || !secrets.crm_database_id) {
      console.error("[get-all-clients] Notion CRM database ID not configured or secrets fetch failed:", secretsError?.message)
      return new Response(JSON.stringify({
        error: 'Notion CRM database ID not configured. Please configure your Notion credentials first.',
        errorCode: 'NOTION_CONFIG_NOT_FOUND'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch clients from the clients_mirror table
    const { data: clientsData, error: fetchError } = await supabase
      .from('clients_mirror')
      .select('id, name, focus, email, phone, star_sign')
      .eq('user_id', user.id) // RLS should handle this, but explicit filter is good practice
      .order('name', { ascending: true });

    if (fetchError) {
      console.error("[get-all-clients] Database fetch error:", fetchError?.message)
      return new Response(JSON.stringify({ error: 'Failed to fetch clients from database', details: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-all-clients] Found", clientsData.length, "clients in clients_mirror")

    const clients = clientsData.map((client: any) => ({
      id: client.id,
      name: client.name,
      focus: client.focus || "",
      email: client.email || "",
      phone: client.phone || "",
      starSign: client.star_sign || "Unknown",
    }))

    if (clients.length === 0) {
        console.log("[get-all-clients] Clients mirror is empty. Suggesting sync.")
        return new Response(JSON.stringify({ 
            error: 'No clients found in local database. Please run a Notion sync.',
            errorCode: 'CLIENTS_MIRROR_EMPTY',
            clients: []
        }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

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