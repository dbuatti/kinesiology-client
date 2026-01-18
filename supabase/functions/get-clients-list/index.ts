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

    // Use service role client to fetch clients data (bypassing RLS for consistency, though RLS is enabled on the table)
    const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)
    
    // Fetch clients directly from the new 'clients' table
    const { data: clientsData, error: fetchError } = await serviceRoleSupabase
      .from('clients')
      .select('id, name, focus, email, phone, star_sign')
      .eq('user_id', user.id) // Filter by user_id explicitly
      .order('name', { ascending: true });

    if (fetchError) {
      console.error("[get-clients-list] Database fetch error:", fetchError?.message)
      return new Response(JSON.stringify({ error: 'Failed to fetch clients from database', details: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-clients-list] Found", clientsData.length, "clients in clients table")

    const clients = clientsData.map((client: any) => ({
      id: client.id,
      name: client.name,
      focus: client.focus || "",
      email: client.email || "",
      phone: client.phone || "",
      starSign: client.star_sign || "Unknown",
    }))

    if (clients.length === 0) {
        console.log("[get-clients-list] Clients table is empty.")
        // Return 200 OK, but include the error code to signal the client table is empty
        return new Response(JSON.stringify({ 
            error: 'No clients found in local database.',
            errorCode: 'CLIENTS_TABLE_EMPTY', // New error code for empty table
            clients: []
        }), {
            status: 200,
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