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
    console.log("[create-appointment] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[create-appointment] Unauthorized: No Authorization header")
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      console.error("[create-appointment] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[create-appointment] User authenticated:", user.id)

    const { clientId, date, goal, sessionNorthStar } = await req.json()

    if (!clientId || !date || !goal || !sessionNorthStar) {
      console.warn("[create-appointment] Bad request: Missing required fields")
      return new Response(JSON.stringify({ error: 'Missing clientId, date, goal, or sessionNorthStar in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        user_id: user.id,
        client_id: clientId,
        date: date, // YYYY-MM-DD format
        goal: goal,
        session_north_star: sessionNorthStar,
        status: 'AP', // Default status: Appointment
      })
      .select()
      .single()

    if (error) {
      console.error("[create-appointment] Database insert error:", error?.message)
      return new Response(JSON.stringify({ error: 'Failed to create appointment', details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[create-appointment] Appointment created successfully:", data.id)

    return new Response(JSON.stringify({ success: true, newAppointmentId: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[create-appointment] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})