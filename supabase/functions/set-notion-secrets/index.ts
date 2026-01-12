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
    console.log("[set-notion-secrets] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[set-notion-secrets] Unauthorized: No Authorization header")
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
      console.error("[set-notion-secrets] User authentication failed:", userError?.message)
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    console.log("[set-notion-secrets] User authenticated:", user.id)

    const { notionToken, appointmentsDbId, crmDbId, modesDbId, acupointsDbId, musclesDbId, channelsDbId, chakrasDbId } = await req.json() // Destructure new channelsDbId and chakrasDbId

    // Upsert into notion_secrets table using service role
    const { error: insertError } = await supabase
      .from('notion_secrets')
      .upsert({
        id: user.id, // Use 'id' as the primary key for the user's secrets
        notion_integration_token: notionToken,
        appointments_database_id: appointmentsDbId,
        crm_database_id: crmDbId || null,
        modes_database_id: modesDbId || null,
        acupoints_database_id: acupointsDbId || null,
        muscles_database_id: musclesDbId || null,
        channels_database_id: channelsDbId || null, // Store new channelsDbId
        chakras_database_id: chakrasDbId || null,  // Store new chakrasDbId
      }, {
        onConflict: 'id' // Conflict on 'id' since it's the primary key
      })

    if (insertError) {
      console.error("[set-notion-secrets] Database error:", insertError?.message)
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
    console.error("[set-notion-secrets] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})