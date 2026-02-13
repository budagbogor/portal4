
import { createClient } from '@supabase/supabase-js';

// Project Reference derived from your JWT Token
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// The Anon Key provided. 
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
