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
    console.log("[get-channels] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[get-channels] Unauthorized: No Authorization header")
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
      console.error("[get-channels] User authentication failed:", userError?.message)
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    console.log("[get-channels] User authenticated:", user.id)

    const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: secrets, error: secretsError } = await serviceRoleSupabase
      .from('notion_secrets')
      .select('notion_integration_token, channels_database_id')
      .eq('id', user.id) // Changed from 'user_id' to 'id'
      .single()

    if (secretsError || !secrets || !secrets.channels_database_id) {
      console.error("[get-channels] Channels database ID not found for user:", user.id, secretsError?.message)
      return new Response(JSON.stringify({
        error: 'Notion Channels database ID not configured. Please configure your Notion credentials first.'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-channels] Channels database ID loaded:", secrets.channels_database_id)

    // Removed search functionality as per user request
    const requestBody: any = {
      sorts: [
        {
          property: "Meridian", // Changed from "Channel" to "Meridian"
          direction: "ascending"
        }
      ]
    };

    const notionChannelsResponse = await fetch('https://api.notion.com/v1/databases/' + secrets.channels_database_id + '/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secrets.notion_integration_token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(requestBody)
    })

    if (!notionChannelsResponse.ok) {
      const errorText = await notionChannelsResponse.text()
      console.error("[get-channels] Notion API (Channels) error:", errorText)
      return new Response(JSON.stringify({ error: 'Failed to fetch channels from Notion', details: errorText }), {
        status: notionChannelsResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const notionChannelsData = await notionChannelsResponse.json()
    console.log("[get-channels] Found", notionChannelsData.results.length, "channels")

    const channels = notionChannelsData.results.map((page: any) => {
      const properties = page.properties
      console.log(`[get-channels] Raw Notion properties for channel ${properties.Meridian?.title?.[0]?.plain_text || page.id}:`, JSON.stringify(properties, null, 2)); // Log raw properties

      return {
        id: page.id,
        name: properties.Meridian?.title?.[0]?.plain_text || "Unknown Channel", // Changed from "Channel" to "Meridian"
        elements: properties.Elements?.multi_select?.map((s: any) => s.name) || [],
        pathways: properties.Pathways?.rich_text?.[0]?.plain_text || "",
        functions: properties.Functions?.rich_text?.[0]?.plain_text || "",
        emotions: properties.Emotion?.multi_select?.map((s: any) => s.name) || [], // Corrected from 'Emotions' to 'Emotion'
        frontMu: properties["Front Mu"]?.rich_text?.[0]?.plain_text || "",
        heSea: properties["He Sea"]?.rich_text?.[0]?.plain_text || "",
        jingRiver: properties["Jing River"]?.rich_text?.[0]?.plain_text || "",
        jingWell: properties["Jing Well"]?.rich_text?.[0]?.plain_text || "",
        akMuscles: properties["AK Muscles"]?.multi_select?.map((s: any) => s.name) || [],
        tcmMuscles: properties["TCM Muscles"]?.multi_select?.map((s: any) => s.name) || [],
        yuanPoints: properties["Yuan Points"]?.rich_text?.[0]?.plain_text || "",
        sedate1: properties["Sedate 1"]?.rich_text?.[0]?.plain_text || "",
        sedate2: properties["Sedate 2"]?.rich_text?.[0]?.plain_text || "",
        tonify1: properties["Tonify 1"]?.rich_text?.[0]?.plain_text || "",
        tonify2: properties["Tonify 2"]?.rich_text?.[0]?.plain_text || "",
        appropriateSound: properties["Appropriate Sound"]?.rich_text?.[0]?.plain_text || "",
        tags: properties.Tags?.multi_select?.map((s: any) => s.name) || [],
        brainAspects: properties["Brain Aspects"]?.rich_text?.[0]?.plain_text || "", // New
        activateSinew: properties["Activate Sinew"]?.rich_text?.[0]?.plain_text || "", // New
        time: properties["Time"]?.rich_text?.[0]?.plain_text || "", // New
        sound: properties["Sound"]?.select?.name || "", // New: Sound (Select column)
      }
    })

    return new Response(JSON.stringify({ channels }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[get-channels] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})