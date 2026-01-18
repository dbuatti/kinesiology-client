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
    console.log("[get-all-appointments] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[get-all-appointments] Unauthorized: No Authorization header")
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
      console.error("[get-all-appointments] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[get-all-appointments] User authenticated:", user.id)

    // Use service role client to fetch data securely
    const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Fetch all appointments, joining with clients table
    const { data: appointmentsData, error: fetchError } = await serviceRoleSupabase
      .from('appointments')
      .select(`
        id,
        client_id,
        date,
        goal,
        session_north_star,
        priority_pattern,
        status,
        notes,
        session_anchor,
        clients (
          id,
          name,
          focus,
          email,
          phone,
          star_sign
        )
      `)
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (fetchError) {
      console.error("[get-all-appointments] Database fetch error:", fetchError?.message)
      return new Response(JSON.stringify({ error: 'Failed to fetch appointments from database', details: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-all-appointments] Found", appointmentsData.length, "appointments")

    const appointments = appointmentsData.map((app: any) => ({
      id: app.id,
      clientName: app.clients.name,
      clientCrmId: app.client_id, // This is now the Supabase client ID
      starSign: app.clients.star_sign || "Unknown",
      clientFocus: app.clients.focus || "",
      sessionNorthStar: app.session_north_star || "",
      clientEmail: app.clients.email || "",
      clientPhone: app.clients.phone || "",
      date: app.date || null,
      goal: app.goal || "",
      priorityPattern: app.priority_pattern || null,
      status: app.status || "UNKNOWN",
      notes: app.notes || "",
      sessionAnchor: app.session_anchor || "",
      acupointId: null, // Not stored directly on appointment anymore
    }))

    return new Response(JSON.stringify({ appointments }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[get-all-appointments] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})