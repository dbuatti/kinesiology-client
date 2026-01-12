import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { supabase } from "./integrations/supabase/client";

// Ensure supabase is available globally
if (typeof window !== 'undefined') {
  window.supabase = supabase;
  window.supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hcriagmovotwuqbppcfm.supabase.co';
}

createRoot(document.getElementById("root")!).render(<App />);