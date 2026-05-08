
import { createClient } from '@supabase/supabase-js';

// Project Reference - Clean quotes and trim whitespace to prevent "Invalid value" fetch errors
const sanitizeEnv = (val: string | undefined) => {
    if (!val) return '';
    return val.trim().replace(/^["'](.+)["']$/, '$1');
};

const SUPABASE_URL = sanitizeEnv(import.meta.env.VITE_SUPABASE_URL);
const SUPABASE_ANON_KEY = sanitizeEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

// Debugging Environment Variables for Production/Vercel
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("CRITICAL: Supabase URL or Anon Key is missing!", {
        url: SUPABASE_URL ? "Exists" : "Missing",
        key: SUPABASE_ANON_KEY ? "Exists" : "Missing"
    });
} else {
    // Log helpful debug info without exposing full key
    console.log("Supabase Client Initialized", {
        url: SUPABASE_URL,
        keyLength: SUPABASE_ANON_KEY.length
    });
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
