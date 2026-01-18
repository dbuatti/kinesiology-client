import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { retryFetch } from '../_shared/notionUtils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to query Notion database and extract results
async function queryNotionDatabase(databaseId: string | null, notionToken: string, databaseName: string): Promise<any[] | null> {
    if (!databaseId) {
        console.log(`[get-all-reference-data] ${databaseName} database ID is missing.`);
        return null;
    }

    try {
        const response = await retryFetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                page_size: 100, // Limit page size for performance
                sorts: [{ property: "Name", direction: "ascending" }] // Default sort
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[get-all-reference-data] Notion API error for ${databaseName}:`, errorText);
            return null;
        }

        const data = await response.json();
        console.log(`[get-all-reference-data] Found ${data.results.length} items in ${databaseName}`);
        return data.results;
    } catch (error) {
        console.error(`[get-all-reference-data] Unexpected error querying ${databaseName}:`, error?.message);
        return null;
    }
}

// Helper function to resolve relation names (used for Channels/Muscles)
const resolveRelation = async (relationId: string | undefined, notionToken: string): Promise<{ id: string; name: string } | null> => {
    if (!relationId) return null;
    try {
        const response = await retryFetch(`https://api.notion.com/v1/pages/${relationId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            }
        });
        if (response.ok) {
            const data = await response.json();
            // Check for common title properties: Name (for muscles/acupoints/chakras) or Meridian (for channels)
            const name = data.properties.Name?.title?.[0]?.plain_text || data.properties.Meridian?.title?.[0]?.plain_text || "Unknown";
            return { id: relationId, name };
        } else {
            console.warn(`[get-all-reference-data] Failed to fetch relation page ${relationId}: ${await response.text()}`);
            return null;
        }
    } catch (err) {
        console.error(`[get-all-reference-data] Error fetching relation page ${relationId}:`, err);
        return null;
    }
};

const resolveMultiSelectRelations = async (relationProperty: any, notionToken: string): Promise<{ id: string; name: string }[]> => {
    const ids = relationProperty?.relation?.map((r: any) => r.id) || [];
    if (ids.length === 0) return [];

    const resolvedItems: { id: string; name: string }[] = [];
    for (const id of ids) {
        const item = await resolveRelation(id, notionToken);
        if (item) resolvedItems.push(item);
    }
    return resolvedItems;
};

// Helper function to resolve Channel Name from Acupoint relation ID
async function resolveChannelName(channelRelationId: string, notionToken: string): Promise<string> {
    if (!channelRelationId) return "";
    try {
        const channelPageResponse = await retryFetch('https://api.notion.com/v1/pages/' + channelRelationId, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            }
        });
        if (channelPageResponse.ok) {
            const channelPageData = await channelPageResponse.json();
            return channelPageData.properties.Name?.title?.[0]?.plain_text || "";
        }
    } catch (channelError) {
        console.error(`[get-all-reference-data] Error fetching channel page ${channelRelationId}:`, channelError);
    }
    return "";
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("[get-all-reference-data] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[get-all-reference-data] Unauthorized: No Authorization header")
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
      console.error("[get-all-reference-data] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[get-all-reference-data] User authenticated:", user.id)

    const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // 1. Fetch Notion credentials
    const { data: secrets, error: secretsError } = await serviceRoleSupabase
      .from('notion_secrets')
      .select('notion_integration_token, modes_database_id, acupoints_database_id, muscles_database_id, channels_database_id, chakras_database_id, tags_database_id')
      .eq('id', user.id)
      .single()

    if (secretsError || !secrets || !secrets.notion_integration_token) {
      console.error("[get-all-reference-data] Notion integration token not configured.")
      return new Response(JSON.stringify({
        error: 'Notion integration token not configured. Please configure your Notion credentials first.',
        errorCode: 'NOTION_CONFIG_NOT_FOUND'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    const notionToken = secrets.notion_integration_token;

    // 2. Query all databases in parallel
    const [
        modesResults, 
        musclesResults, 
        chakrasResults, 
        channelsResults, 
        acupointsResults
    ] = await Promise.all([
        queryNotionDatabase(secrets.modes_database_id, notionToken, 'Modes'),
        queryNotionDatabase(secrets.muscles_database_id, notionToken, 'Muscles'),
        queryNotionDatabase(secrets.chakras_database_id, notionToken, 'Chakras'),
        queryNotionDatabase(secrets.channels_database_id, notionToken, 'Channels'),
        queryNotionDatabase(secrets.acupoints_database_id, notionToken, 'Acupoints'),
    ]);

    // 3. Process results into the final structure (Mapping logic)

    // --- Modes Mapping ---
    const modes = modesResults ? modesResults.map((page: any) => {
        const properties = page.properties
        return {
            id: page.id,
            name: properties.Name?.title?.[0]?.plain_text || "Unknown Mode",
            actionNote: properties["Action Note"]?.rich_text?.[0]?.plain_text || "",
        }
    }) : [];

    // --- Chakras Mapping ---
    const chakras = chakrasResults ? chakrasResults.map((page: any) => {
        const properties = page.properties
        return {
            id: page.id,
            name: properties.Name?.title?.[0]?.plain_text || "Unknown Chakra",
            location: properties.Location?.rich_text?.[0]?.plain_text || "",
            color: properties.Color?.select?.name || null,
            elements: properties.Element?.multi_select?.map((s: any) => s.name) || [],
            associatedOrgans: properties["Associated Organs"]?.multi_select?.map((s: any) => s.name) || [],
            emotionalThemes: properties["Emotional Themes"]?.multi_select?.map((s: any) => s.name) || [],
            affirmations: properties.Affirmations?.rich_text?.[0]?.plain_text || "",
        }
    }) : [];

    // --- Acupoints Mapping (Requires Channel resolution) ---
    const acupoints = acupointsResults ? await Promise.all(acupointsResults.map(async (page: any) => {
        const properties = page.properties
        let channelName = "";

        const channelRelation = properties.Channel?.relation?.[0]?.id;
        if (channelRelation) {
            channelName = await resolveChannelName(channelRelation, notionToken);
        }

        return {
            id: page.id,
            name: properties.Name?.title?.[0]?.plain_text || "Unknown Point",
            for: properties.For?.rich_text?.[0]?.plain_text || "",
            kinesiology: properties.Kinesiology?.rich_text?.[0]?.plain_text || "",
            psychology: properties.Psychology?.rich_text?.[0]?.plain_text || "",
            akMuscles: properties["AK Muscles"]?.multi_select?.map((s: any) => s.name) || [],
            channel: channelName,
            typeOfPoint: properties["Type of point"]?.multi_select?.map((s: any) => s.name) || [],
            time: properties.Time?.multi_select?.map((s: any) => s.name) || [],
        }
    })) : [];

    // --- Muscles Mapping (Requires relation resolution) ---
    const muscles = musclesResults ? await Promise.all(musclesResults.map(async (page: any) => {
        const properties = page.properties
        
        const relatedYuanPoint = await resolveRelation(properties["Related YUAN POINT"]?.relation?.[0]?.id, notionToken);
        const relatedAkChannel = await resolveRelation(properties["Related AK Channel"]?.relation?.[0]?.id, notionToken);
        const relatedTcmChannel = await resolveRelation(properties["Related TCM Channel"]?.relation?.[0]?.id, notionToken);
        const timeAk = await resolveRelation(properties["TIME (AK)"]?.relation?.[0]?.id, notionToken);
        const timeTcm = await resolveRelation(properties["TIME (TCM)"]?.relation?.[0]?.id, notionToken);
        const tags = await resolveMultiSelectRelations(properties["Tag"], notionToken);

        return {
            id: page.id,
            name: properties["Name"]?.title?.[0]?.plain_text || "Unknown Muscle",
            meridian: properties["Meridian"]?.select?.name || "",
            organSystem: properties["Organ System"]?.select?.name || "",
            nlPoints: properties["NL Points (Neurolymphatic)"]?.rich_text?.[0]?.plain_text || "",
            nvPoints: properties["NV Points (Neurovascular)"]?.rich_text?.[0]?.plain_text || "",
            emotionalTheme: properties["Emotional Theme"]?.multi_select?.map((s: any) => s.name) || [],
            nutritionSupport: properties["Nutrition Support"]?.multi_select?.map((s: any) => s.name) || [],
            testPosition: properties["Test Position"]?.files?.[0]?.file?.url || "",
            origin: properties.Origin?.rich_text?.[0]?.plain_text || "",
            insertion: properties.Insertion?.rich_text?.[0]?.plain_text || "",
            action: properties.Action?.rich_text?.[0]?.plain_text || "",
            position: properties.Position?.rich_text?.[0]?.plain_text || "",
            rotation: properties.Rotation?.rich_text?.[0]?.plain_text || "",
            stabilise: properties.Stabilise?.rich_text?.[0]?.plain_text || "",
            monitor: properties.Monitor?.rich_text?.[0]?.plain_text || "",
            nerveSupply: properties["Nerve Supply"]?.rich_text?.[0]?.plain_text || "",
            visceralNerves: properties["Visceral Nerves"]?.rich_text?.[0]?.plain_text || "",
            neuroLymphaticReflex: properties["Neuro-Lymphatic Reflex"]?.rich_text?.[0]?.plain_text || "",
            neuroVascularReflex: properties["Neuro-Vascular Reflex"]?.rich_text?.[0]?.plain_text || "",
            relatedYuanPoint: relatedYuanPoint,
            relatedAkChannel: relatedAkChannel,
            relatedTcmChannel: relatedTcmChannel,
            type: properties.Type?.select?.name || null,
            tags: tags,
            timeAk: timeAk,
            timeTcm: timeTcm,
        }
    })) : [];

    // --- Channels Mapping ---
    const channels = channelsResults ? await Promise.all(channelsResults.map(async (page: any) => {
        const properties = page.properties
        
        const element = properties.Element?.select?.name;
        const elementsArray = element ? [element] : [];

        const resolveChannelMuscleNames = async (relationProperty: any): Promise<{ id: string; name: string }[]> => {
            const muscleIds = relationProperty?.relation?.map((r: any) => r.id) || [];
            if (muscleIds.length === 0) return [];

            const musclesData: { id: string; name: string }[] = [];
            for (const muscleId of muscleIds) {
                const muscle = await resolveRelation(muscleId, notionToken);
                if (muscle) musclesData.push(muscle);
            }
            return musclesData;
        };

        const akMuscles = await resolveChannelMuscleNames(properties["Muscles (AK)"]);
        const tcmMuscles = await resolveChannelMuscleNames(properties["Muscles (TCM)"]);

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
            akMuscles: akMuscles,
            tcmMuscles: tcmMuscles,
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
    })) : [];


    // 4. Return combined data
    const combinedData = {
        modes,
        muscles,
        chakras,
        channels,
        acupoints,
    };

    console.log("[get-all-reference-data] All reference data processed and ready to return.")

    return new Response(JSON.stringify({ data: combinedData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[get-all-reference-data] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})