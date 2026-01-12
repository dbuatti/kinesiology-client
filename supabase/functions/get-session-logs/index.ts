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
    console.log("[get-session-logs] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[get-session-logs] Unauthorized: No Authorization header")
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
      console.error("[get-session-logs] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[get-session-logs] User authenticated:", user.id)

    const { appointmentId } = await req.json()

    if (!appointmentId) {
      console.warn("[get-session-logs] Bad request: Missing appointmentId")
      return new Response(JSON.stringify({ error: 'Missing appointmentId in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch general session logs
    const { data: sessionLogs, error: sessionLogsError } = await supabase
      .from('session_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: true });

    if (sessionLogsError) {
      console.error("[get-session-logs] Error fetching session_logs:", sessionLogsError.message)
      return new Response(JSON.stringify({ error: 'Failed to fetch session logs', details: sessionLogsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch muscle strength logs
    const { data: sessionMuscleLogs, error: sessionMuscleLogsError } = await supabase
      .from('session_muscle_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: true });

    if (sessionMuscleLogsError) {
      console.error("[get-session-logs] Error fetching session_muscle_logs:", sessionMuscleLogsError.message)
      return new Response(JSON.stringify({ error: 'Failed to fetch muscle logs', details: sessionMuscleLogsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-session-logs] Fetched", sessionLogs.length, "session logs and", sessionMuscleLogs.length, "muscle logs for appointment:", appointmentId)

    return new Response(JSON.stringify({ sessionLogs, sessionMuscleLogs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[get-session-logs] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})