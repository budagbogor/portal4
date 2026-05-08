
import { createClient } from '@supabase/supabase-js';

// Project Reference - Trim whitespace to prevent "Invalid value" fetch errors
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Debugging Environment Variables for Production/Vercel
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("CRITICAL: Supabase URL or Anon Key is missing!", {
        url: SUPABASE_URL ? "Exists" : "Missing",
        key: SUPABASE_ANON_KEY ? "Exists" : "Missing"
    });
} else {
    // Log helpful debug info without exposing full key
    console.log("Supabase Initializing...", {
        url: SUPABASE_URL,
        keyPrefix: SUPABASE_ANON_KEY.substring(0, 10) + "...",
        keyLength: SUPABASE_ANON_KEY.length
    });
}

export const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '');
