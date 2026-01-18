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
    console.log("[get-todays-appointments] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[get-todays-appointments] Unauthorized: No Authorization header")
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
      console.error("[get-todays-appointments] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[get-todays-appointments] User authenticated:", user.id)

    // Use service role client to fetch data securely
    const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { todayDate } = await req.json();

    if (!todayDate) {
      console.warn("[get-todays-appointments] Bad request: Missing todayDate in request body")
      return new Response(JSON.stringify({ error: 'Missing todayDate in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch appointments for today, joining with clients table
    const { data: appointmentsData, error: fetchError } = await serviceRoleSupabase
      .from('appointments')
      .select(`
        id,
        date,
        goal,
        session_north_star,
        session_anchor,
        status,
        clients (
          id,
          name,
          star_sign
        )
      `)
      .eq('user_id', user.id)
      .eq('date', todayDate)
      .in('status', ['AP', 'OPEN']) // Filter for appointments or open sessions
      .order('date', { ascending: true });

    if (fetchError) {
      console.error("[get-todays-appointments] Database fetch error:", fetchError?.message)
      return new Response(JSON.stringify({ error: 'Failed to fetch appointments from database', details: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-todays-appointments] Found", appointmentsData.length, "appointments for today")

    const appointments = appointmentsData.map((app: any) => ({
      id: app.id,
      clientName: app.clients.name,
      starSign: app.clients.star_sign || "Unknown",
      sessionNorthStar: app.session_north_star || "",
      goal: app.goal || "",
      sessionAnchor: app.session_anchor || "",
      status: app.status,
    }))

    return new Response(JSON.stringify({ appointments }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[get-todays-appointments] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})