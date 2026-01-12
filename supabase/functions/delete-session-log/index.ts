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
    console.log("[delete-session-log] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[delete-session-log] Unauthorized: No Authorization header")
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
      console.error("[delete-session-log] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[delete-session-log] User authenticated:", user.id)

    const { logId, logType } = await req.json()

    if (!logId || !logType) {
      console.warn("[delete-session-log] Bad request: Missing logId or logType")
      return new Response(JSON.stringify({ error: 'Missing logId or logType in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let error;
    if (logType === 'session_log') {
      const { error: deleteError } = await supabase
        .from('session_logs')
        .delete()
        .eq('id', logId)
        .eq('user_id', user.id); // Ensure user can only delete their own logs
      error = deleteError;
    } else if (logType === 'session_muscle_log') {
      const { error: deleteError } = await supabase
        .from('session_muscle_logs')
        .delete()
        .eq('id', logId)
        .eq('user_id', user.id); // Ensure user can only delete their own logs
      error = deleteError;
    } else {
      console.warn("[delete-session-log] Invalid logType provided:", logType)
      return new Response(JSON.stringify({ error: 'Invalid logType. Must be "session_log" or "session_muscle_log".' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (error) {
      console.error("[delete-session-log] Database delete error:", error?.message)
      return new Response(JSON.stringify({ error: 'Failed to delete session log', details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[delete-session-log] Log entry ${logId} of type ${logType} deleted successfully.`)

    return new Response(JSON.stringify({ success: true, deletedLogId: logId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[delete-session-log] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})