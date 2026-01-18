import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { calculateStarSign } from '../_shared/starSignCalculator.ts'; // Import star sign calculator

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("[update-client] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[update-client] Unauthorized: No Authorization header")
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Use service role client to bypass RLS for the update operation, 
    // but we still enforce user_id check in the query.
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      console.error("[update-client] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[update-client] User authenticated:", user.id)

    const { clientId, updates } = await req.json()

    if (!clientId || !updates) {
      console.warn("[update-client] Bad request: Missing clientId or updates")
      return new Response(JSON.stringify({ error: 'Missing clientId or updates in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const updatePayload: { [key: string]: any } = {
      updated_at: new Date().toISOString()
    };

    // Map updates to database column names
    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.focus !== undefined) updatePayload.focus = updates.focus;
    if (updates.email !== undefined) updatePayload.email = updates.email;
    if (updates.phone !== undefined) updatePayload.phone = updates.phone;
    
    // Handle birthDate update and recalculate star sign
    if (updates.birthDate !== undefined) {
      // Assuming we add a birth_date column to the clients table later
      // updatePayload.birth_date = updates.birthDate; 
      updatePayload.star_sign = calculateStarSign(updates.birthDate);
    } else if (updates.starSign !== undefined) {
      // Allow direct update of starSign if birthDate is not provided
      updatePayload.star_sign = updates.starSign;
    }

    if (Object.keys(updatePayload).length <= 1) { // Only updated_at was set
      console.log("[update-client] No valid fields provided for update.");
      return new Response(JSON.stringify({ success: true, updatedClientId: clientId, message: "No valid properties to update." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Perform the update, ensuring the user owns the client record
    const { data, error } = await supabase
      .from('clients')
      .update(updatePayload)
      .eq('id', clientId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error("[update-client] Database update error:", error?.message)
      return new Response(JSON.stringify({ error: 'Failed to update client in database', details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[update-client] Client updated successfully:", data.id)

    return new Response(JSON.stringify({ success: true, updatedClientId: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[update-client] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})