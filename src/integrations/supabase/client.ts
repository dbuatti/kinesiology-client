import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hcriagmovotwuqbppcfm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjcmlhZ21vdm90d3VxYnBwY2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNzYxNzYsImV4cCI6MjA4Mzc1MjE3Nn0.489QkN2WfOLyLOuO8QOe43mV3Y7hxrrJsmOIpW3nlpc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);