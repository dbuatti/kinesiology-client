// Type declarations for Deno global object
declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }
}

// Type declarations for URL-imported modules in Supabase Edge Functions
declare module "https://deno.land/std@0.190.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): Promise<void>;
}

declare module "https://esm.sh/@supabase/supabase-js@2.45.0" {
  import { SupabaseClient } from '@supabase/supabase-js';
  export function createClient(supabaseUrl: string, supabaseKey: string): SupabaseClient;
}