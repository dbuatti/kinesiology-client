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
      .select('notion_integration_token, acupoints_database_id')
      .eq('user_id', user.id)
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

    const { searchTerm, searchType } = await req.json()

    if (!searchTerm) {
      console.warn("[get-acupoints] Bad request: Missing searchTerm")
      return new Response(JSON.stringify({ error: 'Missing searchTerm in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let filter: any = {};
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

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

    const notionAcupointsResponse = await fetch('https://api.notion.com/v1/databases/' + secrets.acupoints_database_id + '/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secrets.notion_integration_token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        filter: filter,
        sorts: [
          {
            property: "Name",
            direction: "ascending"
          }
        ]
      })
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

    const acupoints = notionAcupointsData.results.map((page: any) => {
      const properties = page.properties
      return {
        id: page.id,
        name: properties.Name?.title?.[0]?.plain_text || "Unknown Point",
        for: properties.For?.rich_text?.[0]?.plain_text || "",
        kinesiology: properties.Kinesiology?.rich_text?.[0]?.plain_text || "",
        psychology: properties.Psychology?.rich_text?.[0]?.plain_text || "",
        akMuscles: properties["AK Muscles"]?.multi_select?.map((s: any) => s.name) || [],
        channel: properties.Channel?.select?.name || "",
        typeOfPoint: properties["Type of point"]?.multi_select?.map((s: any) => s.name) || [],
        time: properties.Time?.multi_select?.map((s: any) => s.name) || [],
      }
    })

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