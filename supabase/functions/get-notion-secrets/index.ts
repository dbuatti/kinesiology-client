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
    console.log("[get-notion-secrets] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[get-notion-secrets] Unauthorized: No Authorization header")
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      console.error("[get-notion-secrets] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[get-notion-secrets] User authenticated:", user.id)

    // Fetch Notion credentials from secure secrets table using service role
    // This bypasses RLS, helping to diagnose the 406 error
    const { data: secrets, error: secretsError } = await supabase
      .from('notion_secrets')
      .select('*')
      .eq('id', user.id)
      .single()

    if (secretsError) {
      console.error("[get-notion-secrets] Database error fetching secrets:", secretsError?.message)
      return new Response(JSON.stringify({
        error: 'Failed to fetch Notion configuration from database.',
        details: secretsError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!secrets) {
      console.log("[get-notion-secrets] No Notion configuration found for user:", user.id)
      return new Response(JSON.stringify({
        error: 'Notion configuration not found.',
        errorCode: 'NOTION_CONFIG_NOT_FOUND'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-notion-secrets] Secrets fetched successfully for user:", user.id)

    return new Response(JSON.stringify({ secrets }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[get-notion-secrets] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})