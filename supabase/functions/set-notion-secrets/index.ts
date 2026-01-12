// @ts-nocheck
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    console.log("[set-notion-secrets] User authenticated:", user.id)

    const { notionToken, appointmentsDbId, crmDbId } = await req.json()

    if (!notionToken || !appointmentsDbId) {
      return new Response(JSON.stringify({ 
        error: 'Integration Token and Appointments Database ID are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Upsert into notion_secrets table
    const { error: insertError } = await supabase
      .from('notion_secrets')
      .upsert({
        user_id: user.id,
        notion_integration_token: notionToken,
        appointments_database_id: appointmentsDbId,
        crm_database_id: crmDbId || null,
      }, {
        onConflict: 'user_id'
      })

    if (insertError) {
      console.error("[set-notion-secrets] Database error:", insertError)
      return new Response(JSON.stringify({ 
        error: 'Database error', 
        details: insertError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[set-notion-secrets] Secrets saved successfully for user:", user.id)

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Notion configuration saved securely' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[set-notion-secrets] Error:", error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})