import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
// No longer importing supabase here as it's not needed globally on window
// import { supabase } from "./integrations/supabase/client"; 

// Removed global window assignments
// if (typeof window !== 'undefined') {
//   window.supabase = supabase;
//   window.supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hcriagmovotwuqbppcfm.supabase.co';
// }

createRoot(document.getElementById("root")!).render(<App />);