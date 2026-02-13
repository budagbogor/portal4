
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from current directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("❌ Missing environment variables!");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkConnection() {
    console.log("Testing Supabase Connection...");
    try {
        const { data, error } = await supabase.from('system_settings').select('count', { count: 'exact', head: true });

        if (error) {
            console.error("❌ Connection Failed:", error.message);
        } else {
            console.log("✅ Connection Successful!");
        }
    } catch (err) {
        console.error("❌ Unexpected Error:", err);
    }
}

checkConnection();
