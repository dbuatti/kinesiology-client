import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { retryFetch } from '../_shared/notionUtils.ts'; // Import the shared utility

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

    // Fetch muscles_database_id along with other secrets
    const { data: secrets, error: secretsError } = await serviceRoleSupabase
      .from('notion_secrets')
      .select('notion_integration_token, channels_database_id, muscles_database_id') // Added muscles_database_id
      .eq('id', user.id)
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
    if (!secrets.muscles_database_id) {
      console.warn("[get-channels] Muscles database ID not configured. AK Muscles and TCM Muscles will not be resolved.")
    }

    const requestBody: any = {
      sorts: [
        {
          property: "Meridian",
          direction: "ascending"
        }
      ]
    };

    const notionChannelsResponse = await retryFetch('https://api.notion.com/v1/databases/' + secrets.channels_database_id + '/query', {
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

    const channels = await Promise.all(notionChannelsData.results.map(async (page: any) => {
      const properties = page.properties
      
      const element = properties.Element?.select?.name;
      const elementsArray = element ? [element] : [];

      // Function to resolve muscle names from relation IDs
      const resolveMuscleNames = async (relationProperty: any): Promise<{ id: string; name: string }[]> => {
        const muscleIds = relationProperty?.relation?.map((r: any) => r.id) || [];
        if (muscleIds.length === 0 || !secrets.muscles_database_id) {
          return [];
        }

        const musclesData: { id: string; name: string }[] = [];
        for (const muscleId of muscleIds) {
          try {
            const musclePageResponse = await retryFetch('https://api.notion.com/v1/pages/' + muscleId, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${secrets.notion_integration_token}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
              }
            });
            if (musclePageResponse.ok) {
              const musclePageData = await musclePageResponse.json();
              const muscleName = musclePageData.properties.Name?.title?.[0]?.plain_text;
              if (muscleName) {
                musclesData.push({ id: muscleId, name: muscleName });
              }
            } else {
              const errorText = await musclePageResponse.text();
              console.warn(`[get-channels] Failed to fetch muscle page ${muscleId}:`, errorText);
            }
          } catch (muscleError) {
            console.error(`[get-channels] Error fetching muscle page ${muscleId}:`, muscleError);
          }
        }
        return musclesData;
      };

      const akMuscles = await resolveMuscleNames(properties["Muscles (AK)"]);
      const tcmMuscles = await resolveMuscleNames(properties["Muscles (TCM)"]);

      return {
        id: page.id,
        name: properties.Meridian?.title?.[0]?.plain_text || "Unknown Channel",
        elements: elementsArray,
        pathways: properties.Pathways?.rich_text?.[0]?.plain_text || "",
        functions: properties.Functions?.rich_text?.[0]?.plain_text || "",
        emotions: properties.Emotion?.multi_select?.map((s: any) => s.name) || [],
        frontMu: properties["Front Mu"]?.rich_text?.[0]?.plain_text || "",
        heSea: properties["He Sea"]?.rich_text?.[0]?.plain_text || "",
        jingRiver: properties["Jing River"]?.rich_text?.[0]?.plain_text || "",
        jingWell: properties["Jing Well"]?.rich_text?.[0]?.plain_text || "",
        akMuscles: akMuscles, // Resolved names
        tcmMuscles: tcmMuscles, // Resolved names
        yuanPoints: properties["Yuan Points"]?.rich_text?.[0]?.plain_text || "",
        sedate1: properties["Sedate 1"]?.rich_text?.[0]?.plain_text || "",
        sedate2: properties["Sedate 2"]?.rich_text?.[0]?.plain_text || "",
        tonify1: properties["Tonify 1"]?.rich_text?.[0]?.plain_text || "",
        tonify2: properties["Tonify 2"]?.rich_text?.[0]?.plain_text || "",
        appropriateSound: properties["Appropriate Sound"]?.rich_text?.[0]?.plain_text || "",
        tags: properties.Tags?.multi_select?.map((s: any) => s.name) || [],
        brainAspects: properties["Brain Aspects"]?.rich_text?.[0]?.plain_text || "",
        activateSinew: properties["Activate Sinew"]?.rich_text?.[0]?.plain_text || "",
        time: properties["Time"]?.rich_text?.[0]?.plain_text || "",
        sound: properties["Sound"]?.select?.name || "",
      }
    }))

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