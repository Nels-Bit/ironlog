import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// DEBUG LOGGING
console.log("--- DEBUGGING SUPABASE ---");
console.log("URL exists?", !!supabaseUrl);
console.log("Key exists?", !!supabaseAnonKey);
console.log("URL Value:", supabaseUrl); // It's okay to log this temporarily to check for typos

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase Environment Variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);