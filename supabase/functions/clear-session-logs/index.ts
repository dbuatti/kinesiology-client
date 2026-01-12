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
    console.log("[clear-session-logs] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[clear-session-logs] Unauthorized: No Authorization header")
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
      console.error("[clear-session-logs] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[clear-session-logs] User authenticated:", user.id)

    const { appointmentId } = await req.json()

    if (!appointmentId) {
      console.warn("[clear-session-logs] Bad request: Missing appointmentId")
      return new Response(JSON.stringify({ error: 'Missing appointmentId in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Delete from session_logs
    const { error: sessionLogsDeleteError } = await supabase
      .from('session_logs')
      .delete()
      .eq('appointment_id', appointmentId)
      .eq('user_id', user.id);

    if (sessionLogsDeleteError) {
      console.error("[clear-session-logs] Database delete error for session_logs:", sessionLogsDeleteError?.message)
      return new Response(JSON.stringify({ error: 'Failed to clear session logs', details: sessionLogsDeleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Delete from session_muscle_logs
    const { error: sessionMuscleLogsDeleteError } = await supabase
      .from('session_muscle_logs')
      .delete()
      .eq('appointment_id', appointmentId)
      .eq('user_id', user.id);

    if (sessionMuscleLogsDeleteError) {
      console.error("[clear-session-logs] Database delete error for session_muscle_logs:", sessionMuscleLogsDeleteError?.message)
      return new Response(JSON.stringify({ error: 'Failed to clear session muscle logs', details: sessionMuscleLogsDeleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[clear-session-logs] All logs for appointment ${appointmentId} cleared successfully.`)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[clear-session-logs] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})