import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Define the mock ID used in the client DebugZone
const MOCK_APPOINTMENT_ID = '00000000-0000-0000-0000-000000000000';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("[get-single-appointment] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[get-single-appointment] Unauthorized: No Authorization header")
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
      console.error("[get-single-appointment] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[get-single-appointment] User authenticated:", user.id)

    const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { appointmentId } = await req.json();

    if (!appointmentId) {
      console.warn("[get-single-appointment] Bad request: Missing appointmentId")
      return new Response(JSON.stringify({ error: 'Missing appointmentId in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Handle the mock ID case gracefully for the Debug Zone
    if (appointmentId === MOCK_APPOINTMENT_ID) {
      console.warn("[get-single-appointment] Using mock data for Debug Zone ID.")
      const mockAppointment = {
        id: MOCK_APPOINTMENT_ID,
        clientName: "Debug Client (Mock)",
        starSign: "♑ Capricorn",
        sessionNorthStar: "Testing the live session dashboard functionality.",
        goal: "Ensure all selectors and logging mechanisms work correctly.",
        sessionAnchor: "Focusing on UI/UX and data flow.",
        status: "OPEN"
      };
      return new Response(JSON.stringify({ appointment: mockAppointment }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch the appointment, joining with clients table
    const { data: appointmentData, error: fetchError } = await serviceRoleSupabase
      .from('appointments')
      .select(`
        id,
        goal,
        session_north_star,
        session_anchor,
        status,
        clients (
          name,
          star_sign
        )
      `)
      .eq('id', appointmentId)
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      console.error("[get-single-appointment] Database fetch error:", fetchError?.message)
      return new Response(JSON.stringify({ error: 'Failed to fetch appointment from database', details: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!appointmentData) {
      console.error("[get-single-appointment] Appointment not found:", appointmentId)
      return new Response(JSON.stringify({ error: 'Appointment not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-single-appointment] Found appointment:", appointmentData.id)

    // Access client properties directly from the joined object
    const clientData = appointmentData.clients as { name: string, star_sign: string };

    const appointment = {
      id: appointmentData.id,
      clientName: clientData.name,
      starSign: clientData.star_sign || "Unknown",
      sessionNorthStar: appointmentData.session_north_star || "",
      goal: appointmentData.goal || "",
      sessionAnchor: appointmentData.session_anchor || "",
      status: appointmentData.status || "UNKNOWN"
    }

    return new Response(JSON.stringify({ appointment }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[get-single-appointment] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})