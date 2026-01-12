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
      .eq('user_id', user.id)
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

    const { searchTerm, searchType } = await req.json()

    let filter: any = undefined;
    const lowerCaseSearchTerm = searchTerm ? searchTerm.toLowerCase() : '';

    if (searchTerm && searchTerm.trim() !== '') {
      if (searchType === 'name') {
        filter = {
          property: "Name",
          title: {
            contains: searchTerm
          }
        };
      } else if (searchType === 'element') {
        filter = {
          property: "Elements",
          multi_select: {
            contains: searchTerm
          }
        };
      } else if (searchType === 'emotion') {
        filter = {
          property: "Emotions",
          multi_select: {
            contains: searchTerm
          }
        };
      } else {
        console.warn("[get-channels] Invalid searchType:", searchType)
        return new Response(JSON.stringify({ error: 'Invalid searchType. Must be "name", "element", or "emotion".' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else {
      console.log("[get-channels] No search term provided, fetching all channels.");
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
      return {
        id: page.id,
        name: properties.Name?.title?.[0]?.plain_text || "Unknown Channel",
        elements: properties.Elements?.multi_select?.map((s: any) => s.name) || [],
        pathways: properties.Pathways?.rich_text?.[0]?.plain_text || "",
        functions: properties.Functions?.rich_text?.[0]?.plain_text || "",
        emotions: properties.Emotions?.multi_select?.map((s: any) => s.name) || [],
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