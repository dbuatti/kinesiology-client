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
    console.log("[create-client] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[create-client] Unauthorized: No Authorization header")
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
      console.error("[create-client] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[create-client] User authenticated:", user.id)

    const { name, focus, email, phone } = await req.json()

    if (!name) {
      console.warn("[create-client] Bad request: Missing name")
      return new Response(JSON.stringify({ error: 'Missing name in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Calculate star sign based on birth date (if provided in future)
    // For now, we'll set it to "Unknown" or calculate based on a placeholder
    // Let's add a birth_date field to the clients table in the future
    // For now, we'll just set star_sign to "Unknown"
    const starSign = "Unknown";

    const { data, error } = await supabase
      .from('clients')
      .insert({
        user_id: user.id,
        name: name,
        focus: focus || null,
        email: email || null,
        phone: phone || null,
        star_sign: starSign,
      })
      .select()
      .single()

    if (error) {
      console.error("[create-client] Database insert error:", error?.message)
      return new Response(JSON.stringify({ error: 'Failed to create client', details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[create-client] Client created successfully:", data.id)

    return new Response(JSON.stringify({ success: true, newClientId: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[create-client] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})