
import { createClient } from '@supabase/supabase-js';

// Project Reference derived from your JWT Token
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// The Anon Key provided. 
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debugging Environment Variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("CRITICAL: Supabase URL or Anon Key is missing!", {
        url: SUPABASE_URL,
        key: SUPABASE_ANON_KEY ? "Set (Hidden)" : "Missing"
    });
} else {
    console.log("Supabase Client Initialized with URL:", SUPABASE_URL);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
