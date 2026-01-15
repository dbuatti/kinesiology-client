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
    console.log("[log-muscle-strength] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[log-muscle-strength] Unauthorized: No Authorization header")
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
      console.error("[log-muscle-strength] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[log-muscle-strength] User authenticated:", user.id)

    const { appointmentId, muscleId, muscleName, isStrong, notes } = await req.json()

    if (!appointmentId || !muscleId || !muscleName || typeof isStrong !== 'boolean') {
      console.warn("[log-muscle-strength] Bad request: Missing required fields")
      return new Response(JSON.stringify({ error: 'Missing appointmentId, muscleId, muscleName, or isStrong in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data, error } = await supabase
      .from('session_muscle_logs')
      .insert({
        user_id: user.id,
        appointment_id: appointmentId,
        muscle_id: muscleId,
        muscle_name: muscleName,
        is_strong: isStrong,
        notes: notes || null, // Use the received notes, defaulting to null if empty
      })
      .select()
      .single()

    if (error) {
      console.error("[log-muscle-strength] Database insert error:", error?.message)
      return new Response(JSON.stringify({ error: 'Failed to log muscle strength', details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[log-muscle-strength] Muscle strength logged successfully:", data.id)

    return new Response(JSON.stringify({ success: true, logId: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[log-muscle-strength] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})