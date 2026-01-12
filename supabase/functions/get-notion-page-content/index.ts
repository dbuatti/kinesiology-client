import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function for exponential backoff retry
async function retryFetch(url: string, options: RequestInit, retries = 5, delay = 2000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);
    if (response.status !== 429) {
      return response;
    }
    console.warn(`[get-notion-page-content] Rate limit hit (429) for ${url}. Retrying in ${delay / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    delay *= 2; // Exponential backoff
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries due to rate limiting.`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("[get-notion-page-content] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[get-notion-page-content] Unauthorized: No Authorization header")
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      console.error("[get-notion-page-content] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[get-notion-page-content] User authenticated:", user.id)

    const { pageId } = await req.json()

    if (!pageId) {
      console.warn("[get-notion-page-content] Bad request: Missing pageId")
      return new Response(JSON.stringify({ error: 'Missing pageId in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch Notion credentials from secure secrets table
    const { data: secrets, error: secretsError } = await supabase
      .from('notion_secrets')
      .select('notion_integration_token')
      .eq('id', user.id)
      .single()

    if (secretsError || !secrets || !secrets.notion_integration_token) {
      console.error("[get-notion-page-content] Notion integration token not found for user:", user.id, secretsError?.message)
      return new Response(JSON.stringify({
        error: 'Notion integration token not configured. Please configure your Notion credentials first.'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[get-notion-page-content] Notion integration token loaded.")

    const notionIntegrationToken = secrets.notion_integration_token;

    // Fetch page properties to get the title
    const pageResponse = await retryFetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${notionIntegrationToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      }
    });

    if (!pageResponse.ok) {
      const errorText = await pageResponse.text();
      console.error("[get-notion-page-content] Notion API (Page) error:", errorText);
      return new Response(JSON.stringify({ error: 'Failed to fetch Notion page details', details: errorText }), {
        status: pageResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const pageData = await pageResponse.json();
    const title = pageData.properties.Name?.title?.[0]?.plain_text || 'Untitled Page';
    console.log(`[get-notion-page-content] Fetched page title: ${title}`);

    // Fetch block content
    const blocksResponse = await retryFetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${notionIntegrationToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      }
    })

    if (!blocksResponse.ok) {
      const errorText = await blocksResponse.text()
      console.error("[get-notion-page-content] Notion API (Blocks) error:", errorText)
      return new Response(JSON.stringify({ error: 'Failed to fetch Notion page content', details: errorText }), {
        status: blocksResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const blocksData = await blocksResponse.json()
    console.log("[get-notion-page-content] Found", blocksData.results.length, "blocks")

    // Recursively fetch children for nested blocks (e.g., toggles, lists)
    const fetchChildren = async (block: any) => {
      if (block.has_children) {
        const childrenResponse = await retryFetch(`https://api.notion.com/v1/blocks/${block.id}/children`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${notionIntegrationToken}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          }
        });
        if (childrenResponse.ok) {
          const childrenData = await childrenResponse.json();
          block[block.type].children = await Promise.all(childrenData.results.map(fetchChildren));
        } else {
          console.warn(`[get-notion-page-content] Failed to fetch children for block ${block.id}:`, await childrenResponse.text());
        }
      }
      return block;
    };

    const processedBlocks = await Promise.all(blocksData.results.map(fetchChildren));

    // Map Notion API response to our simplified NotionBlock interface
    const mapNotionBlock = (block: any): any => {
      const type = block.type;
      const blockContent: any = { id: block.id, type };

      if (block[type] && block[type].rich_text) {
        blockContent.text = block[type].rich_text;
      } else if (block[type] && block[type].caption) { // For images
        blockContent.caption = block[type].caption;
      }

      if (type === 'image') {
        blockContent.url = block.image.type === 'external' ? block.image.external.url : block.image.file.url;
      } else if (type === 'to_do') {
        blockContent.checked = block.to_do.checked;
      } else if (type === 'callout') {
        blockContent.color = block.callout.color;
        blockContent.icon = block.callout.icon;
      }

      if (block[type]?.children) {
        blockContent.children = block[type].children.map(mapNotionBlock);
      }

      return blockContent;
    };

    const simplifiedBlocks = processedBlocks.map(mapNotionBlock);

    return new Response(JSON.stringify({ title, blocks: simplifiedBlocks }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[get-notion-page-content] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})