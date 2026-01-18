import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { retryFetch } from '../_shared/notionUtils.ts';
import { calculateStarSign } from '../_shared/starSignCalculator.ts'; // Import star sign calculator

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("[sync-notion-data] Starting function execution")

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.warn("[sync-notion-data] Unauthorized: No Authorization header")
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
      console.error("[sync-notion-data] User authentication failed:", userError?.message)
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      })
    }

    console.log("[sync-notion-data] User authenticated:", user.id)

    // Fetch Notion credentials
    const { data: secrets, error: secretsError } = await supabase
      .from('notion_secrets')
      .select('notion_integration_token, modes_database_id, acupoints_database_id, muscles_database_id, channels_database_id, chakras_database_id, tags_database_id') // Removed core data IDs
      .eq('id', user.id)
      .single()

    if (secretsError || !secrets) {
      console.error("[sync-notion-data] Notion configuration not found for user:", user.id, secretsError?.message)
      return new Response(JSON.stringify({
        error: 'Notion configuration not found. Please configure your Notion credentials first.'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log("[sync-notion-data] Secrets loaded successfully for user:", user.id)

    // Sync data based on request type
    const { syncType } = await req.json();
    const results: any = {};
    // Use the service role client created above for writing to notion_cache table
    const serviceRoleSupabase = supabase; 

    // Helper function to sync a database to notion_cache
    const syncDatabaseToCache = async (databaseId: string | null, databaseName: string) => {
      if (!databaseId) {
        console.log(`[sync-notion-data] ${databaseName} database ID not configured, skipping cache sync.`);
        return null;
      }

      console.log(`[sync-notion-data] Syncing ${databaseName} database to cache...`);
      
      const response = await retryFetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secrets.notion_integration_token}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          page_size: 100 // Limit to 100 items per sync to avoid timeouts
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[sync-notion-data] Notion API error for ${databaseName}:`, errorText);
        return null;
      }

      const data = await response.json();
      console.log(`[sync-notion-data] Found ${data.results.length} items in ${databaseName}`);
      
      // Cache the results
      const cacheKey = `${user.id}:${databaseName.toLowerCase()}`;
      // Use serviceRoleSupabase (which is just 'supabase' here) for upserting cache
      await serviceRoleSupabase
        .from('notion_cache')
        .upsert({
          id: cacheKey,
          data: { [databaseName.toLowerCase()]: data.results },
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour TTL
          updated_at: new Date().toISOString(),
        });

      return data.results.length; // Return count instead of results array
    };

    // Sync based on type or all if no type specified
    if (!syncType || syncType === 'all' || syncType === 'modes') {
      results.modes = await syncDatabaseToCache(secrets.modes_database_id, 'modes');
    }
    if (!syncType || syncType === 'all' || syncType === 'acupoints') {
      results.acupoints = await syncDatabaseToCache(secrets.acupoints_database_id, 'acupoints');
    }
    if (!syncType || syncType === 'all' || syncType === 'muscles') {
      results.muscles = await syncDatabaseToCache(secrets.muscles_database_id, 'muscles');
    }
    if (!syncType || syncType === 'all' || syncType === 'channels') {
      results.channels = await syncDatabaseToCache(secrets.channels_database_id, 'channels');
    }
    if (!syncType || syncType === 'all' || syncType === 'chakras') {
      results.chakras = await syncDatabaseToCache(secrets.chakras_database_id, 'chakras');
    }
    if (!syncType || syncType === 'all' || syncType === 'tags') {
      results.tags = await syncDatabaseToCache(secrets.tags_database_id, 'tags');
    }


    console.log("[sync-notion-data] Sync completed successfully")

    return new Response(JSON.stringify({ 
      success: true, 
      synced: Object.keys(results).filter(k => results[k] !== null),
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error("[sync-notion-data] Unexpected error:", error?.message)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})