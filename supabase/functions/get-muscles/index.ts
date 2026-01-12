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
    console.log("[get-muscles] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[get-muscles] Unauthorized: No Authorization header")
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
      console.error("[get-muscles] User authentication failed:", userError?.message)
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    console.log("[get-muscles] User authenticated:", user.id)

    const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: secrets, error: secretsError } = await serviceRoleSupabase
      .from('notion_secrets')
      .select('notion_integration_token, muscles_database_id')
      .eq('id', user.id) // Changed from 'user_id' to 'id'
      .single()

    if (secretsError || !secrets || !secrets.muscles_database_id) {
      console.error("[get-muscles] Muscles database ID not found for user:", user.id, secretsError?.message)
      return new Response(JSON.stringify({
        error: 'Notion Muscles database ID not configured. Please configure your Notion credentials first.'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-muscles] Muscles database ID loaded:", secrets.muscles_database_id)

    const { searchTerm, searchType } = await req.json()

    let filter: any = undefined; // Initialize filter as undefined
    const lowerCaseSearchTerm = searchTerm ? searchTerm.toLowerCase() : '';

    if (searchTerm && searchTerm.trim() !== '') { // Only apply filter if searchTerm is not empty
      if (searchType === 'muscle') {
        filter = {
          property: "Name", // Changed from "Muscle Name" to "Name"
          title: {
            contains: searchTerm // Notion API title search is case-sensitive
          }
        };
      } else if (searchType === 'meridian' || searchType === 'organ') {
        filter = {
          or: [
            {
              property: "Meridian", // Changed from "Associated Meridian" to "Meridian"
              select: {
                equals: searchTerm
              }
            },
            {
              property: "Organ System",
              select: {
                equals: searchTerm
              }
            }
          ]
        };
      } else if (searchType === 'emotion') {
        filter = {
          property: "Emotional Theme",
          multi_select: {
            contains: searchTerm
          }
        };
      } else {
        console.warn("[get-muscles] Invalid searchType:", searchType)
        return new Response(JSON.stringify({ error: 'Invalid searchType. Must be "muscle", "meridian", "organ", or "emotion".' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else {
      console.log("[get-muscles] No search term provided, fetching all muscles.");
    }

    const requestBody: any = {
      sorts: [
        {
          property: "Name", // Changed from "Muscle Name" to "Name"
          direction: "ascending"
        }
      ]
    };

    if (filter) {
      requestBody.filter = filter;
    }

    const notionMusclesResponse = await fetch('https://api.notion.com/v1/databases/' + secrets.muscles_database_id + '/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secrets.notion_integration_token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(requestBody)
    })

    if (!notionMusclesResponse.ok) {
      const errorText = await notionMusclesResponse.text()
      console.error("[get-muscles] Notion API (Muscles) error:", errorText)
      return new Response(JSON.stringify({ error: 'Failed to fetch muscles from Notion', details: errorText }), {
        status: notionMusclesResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const notionMusclesData = await notionMusclesResponse.json()
    console.log("[get-muscles] Found", notionMusclesData.results.length, "muscles")

    const muscles = notionMusclesData.results.map((page: any) => {
      const properties = page.properties
      return {
        id: page.id,
        name: properties["Name"]?.title?.[0]?.plain_text || "Unknown Muscle", // Changed from "Muscle Name" to "Name"
        meridian: properties["Meridian"]?.select?.name || "", // Changed from "Associated Meridian" to "Meridian"
        organSystem: properties["Organ System"]?.select?.name || "",
        nlPoints: properties["NL Points (Neurolymphatic)"]?.rich_text?.[0]?.plain_text || "",
        nvPoints: properties["NV Points (Neurovascular)"]?.rich_text?.[0]?.plain_text || "",
        emotionalTheme: properties["Emotional Theme"]?.multi_select?.map((s: any) => s.name) || [],
        nutritionSupport: properties["Nutrition Support"]?.multi_select?.map((s: any) => s.name) || [],
        testPosition: properties["Test Position"]?.files?.[0]?.file?.url || "", // Assuming first file is the image
      }
    })

    return new Response(JSON.stringify({ muscles }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[get-muscles] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})