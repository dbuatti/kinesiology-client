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
    console.log("[update-appointment] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[update-appointment] Unauthorized: No Authorization header")
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
      console.error("[update-appointment] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[update-appointment] User authenticated:", user.id)

    const { appointmentId, updates } = await req.json()

    if (!appointmentId || !updates) {
      console.warn("[update-appointment] Bad request: Missing appointmentId or updates")
      return new Response(JSON.stringify({ error: 'Missing appointmentId or updates in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const updatePayload: { [key: string]: any } = {
      updated_at: new Date().toISOString()
    };

    // Map updates to database column names
    if (updates.sessionAnchor !== undefined) updatePayload.session_anchor = updates.sessionAnchor;
    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.goal !== undefined) updatePayload.goal = updates.goal;
    if (updates.priorityPattern !== undefined) updatePayload.priority_pattern = updates.priorityPattern;
    if (updates.notes !== undefined) updatePayload.notes = updates.notes;
    if (updates.sessionNorthStar !== undefined) updatePayload.session_north_star = updates.sessionNorthStar;
    // Note: Acupoint relation updates are complex and usually handled via session logs, 
    // but we remove the Notion-specific relation logic here.

    if (Object.keys(updatePayload).length <= 1) { // Only updated_at was set
      console.log("[update-appointment] No valid fields provided for update.");
      return new Response(JSON.stringify({ success: true, updatedPageId: appointmentId, message: "No valid properties to update." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Perform the update on the Supabase appointments table
    const { data, error } = await supabase
      .from('appointments')
      .update(updatePayload)
      .eq('id', appointmentId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error("[update-appointment] Database update error:", error?.message)
      return new Response(JSON.stringify({ error: 'Failed to update appointment in database', details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[update-appointment] Appointment updated successfully:", data.id)

    return new Response(JSON.stringify({ success: true, updatedPageId: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[update-appointment] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})