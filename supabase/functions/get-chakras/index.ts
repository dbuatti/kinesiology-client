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
    console.log("[get-chakras] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[get-chakras] Unauthorized: No Authorization header")
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
      console.error("[get-chakras] User authentication failed:", userError?.message)
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    console.log("[get-chakras] User authenticated:", user.id)

    const serviceRoleSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: secrets, error: secretsError } = await serviceRoleSupabase
      .from('notion_secrets')
      .select('notion_integration_token, chakras_database_id')
      .eq('id', user.id) // Changed from 'user_id' to 'id'
      .single()

    if (secretsError || !secrets || !secrets.chakras_database_id) {
      console.error("[get-chakras] Chakras database ID not found for user:", user.id, secretsError?.message)
      return new Response(JSON.stringify({
        error: 'Notion Chakras database ID not configured. Please configure your Notion credentials first.'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-chakras] Chakras database ID loaded:", secrets.chakras_database_id)

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
          property: "Element",
          multi_select: {
            contains: searchTerm
          }
        };
      } else if (searchType === 'emotion') {
        filter = {
          property: "Emotional Themes",
          multi_select: {
            contains: searchTerm
          }
        };
      } else if (searchType === 'organ') {
        filter = {
          property: "Associated Organs",
          multi_select: {
            contains: searchTerm
          }
        };
      } else {
        console.warn("[get-chakras] Invalid searchType:", searchType)
        return new Response(JSON.stringify({ error: 'Invalid searchType. Must be "name", "element", "emotion", or "organ".' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else {
      console.log("[get-chakras] No search term provided, fetching all chakras.");
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

    const notionChakrasResponse = await fetch('https://api.notion.com/v1/databases/' + secrets.chakras_database_id + '/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secrets.notion_integration_token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(requestBody)
    })

    if (!notionChakrasResponse.ok) {
      const errorText = await notionChakrasResponse.text()
      console.error("[get-chakras] Notion API (Chakras) error:", errorText)
      return new Response(JSON.stringify({ error: 'Failed to fetch chakras from Notion', details: errorText }), {
        status: notionChakrasResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const notionChakrasData = await notionChakrasResponse.json()
    console.log("[get-chakras] Found", notionChakrasData.results.length, "chakras")

    const chakras = notionChakrasData.results.map((page: any) => {
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
    })

    return new Response(JSON.stringify({ chakras }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[get-chakras] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})