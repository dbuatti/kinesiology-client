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
    console.log("[get-acupoints] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[get-acupoints] Unauthorized: No Authorization header")
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
      console.error("[get-acupoints] User authentication failed:", userError?.message)
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    console.log("[get-acupoints] User authenticated:", user.id)

    const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: secrets, error: secretsError } = await serviceRoleSupabase
      .from('notion_secrets')
      .select('notion_integration_token, acupoints_database_id, channels_database_id') // Fetch channels_database_id
      .eq('id', user.id) // Changed from 'user_id' to 'id'
      .single()

    if (secretsError || !secrets || !secrets.acupoints_database_id) {
      console.error("[get-acupoints] Acupoints database ID not found for user:", user.id, secretsError?.message)
      return new Response(JSON.stringify({
        error: 'Notion Acupoints database ID not configured. Please configure your Notion credentials first.'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-acupoints] Acupoints database ID loaded:", secrets.acupoints_database_id)
    if (!secrets.channels_database_id) {
      console.warn("[get-acupoints] Channels database ID not configured. Channel names will not be resolved.")
    }

    const { searchTerm, searchType } = await req.json()

    let filter: any = undefined; // Initialize filter as undefined
    const lowerCaseSearchTerm = searchTerm ? searchTerm.toLowerCase() : '';

    if (searchTerm && searchTerm.trim() !== '') { // Only apply filter if searchTerm is not empty
      if (searchType === 'point') {
        filter = {
          property: "Name",
          title: {
            contains: searchTerm // Case-sensitive, Notion API doesn't support case-insensitive for title
          }
        };
      } else if (searchType === 'symptom') {
        filter = {
          or: [
            {
              property: "Tag (Primary)",
              multi_select: {
                contains: searchTerm
              }
            },
            {
              property: "subtag",
              multi_select: {
                contains: searchTerm
              }
            },
            {
              property: "Psychology",
              rich_text: {
                contains: searchTerm
              }
            }
          ]
        };
      } else {
        console.warn("[get-acupoints] Invalid searchType:", searchType)
        return new Response(JSON.stringify({ error: 'Invalid searchType. Must be "point" or "symptom".' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else {
      console.log("[get-acupoints] No search term provided, fetching all acupoints.");
    }

    const requestBody: any = {
      sorts: [
        {
          property: "Name",
          direction: "ascending"
        }
      ]
    };

    if (filter) {
      requestBody.filter = filter;
    }

    const notionAcupointsResponse = await retryFetch('https://api.notion.com/v1/databases/' + secrets.acupoints_database_id + '/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secrets.notion_integration_token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(requestBody)
    })

    if (!notionAcupointsResponse.ok) {
      const errorText = await notionAcupointsResponse.text()
      console.error("[get-acupoints] Notion API (Acupoints) error:", errorText)
      return new Response(JSON.stringify({ error: 'Failed to fetch acupoints from Notion', details: errorText }), {
        status: notionAcupointsResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const notionAcupointsData = await notionAcupointsResponse.json()
    console.log("[get-acupoints] Found", notionAcupointsData.results.length, "acupoints")

    const acupoints = await Promise.all(notionAcupointsData.results.map(async (page: any) => {
      const properties = page.properties
      let channelName = "";

      // Handle Channel as a relation property
      const channelRelation = properties.Channel?.relation?.[0]?.id;
      if (channelRelation && secrets.channels_database_id) {
        console.log(`[get-acupoints] Fetching channel name for ID: ${channelRelation}`);
        try {
          const channelPageResponse = await retryFetch('https://api.notion.com/v1/pages/' + channelRelation, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${secrets.notion_integration_token}`,
              'Content-Type': 'application/json',
              'Notion-Version': '2022-06-28'
            }
          });
          if (channelPageResponse.ok) {
            const channelPageData = await channelPageResponse.json();
            channelName = channelPageData.properties.Name?.title?.[0]?.plain_text || "";
            console.log(`[get-acupoints] Resolved channel name: ${channelName}`);
          } else {
            const errorText = await channelPageResponse.text();
            console.warn(`[get-acupoints] Failed to fetch channel page ${channelRelation}:`, errorText);
          }
        } catch (channelError) {
          console.error(`[get-acupoints] Error fetching channel page ${channelRelation}:`, channelError);
        }
      } else if (channelRelation && !secrets.channels_database_id) {
        console.warn(`[get-acupoints] Channel relation found for ${page.id} but channels_database_id is not configured. Cannot resolve channel name.`);
      }


      return {
        id: page.id,
        name: properties.Name?.title?.[0]?.plain_text || "Unknown Point",
        for: properties.For?.rich_text?.[0]?.plain_text || "",
        kinesiology: properties.Kinesiology?.rich_text?.[0]?.plain_text || "",
        psychology: properties.Psychology?.rich_text?.[0]?.plain_text || "",
        akMuscles: properties["AK Muscles"]?.multi_select?.map((s: any) => s.name) || [],
        channel: channelName, // Use the resolved channel name
        typeOfPoint: properties["Type of point"]?.multi_select?.map((s: any) => s.name) || [],
        time: properties.Time?.multi_select?.map((s: any) => s.name) || [],
      }
    }))

    return new Response(JSON.stringify({ acupoints }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[get-acupoints] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})