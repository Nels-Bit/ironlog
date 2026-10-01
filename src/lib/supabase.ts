import { createClient } from '@supabase/supabase-js';
import { createDemoProvider } from './demo-transport';
import { createIronLogSeed } from './demo-seed';
import { isDemoSession, rememberDemo, exitDemo } from './demo-session';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const demoMode = isDemoSession();
if (demoMode) rememberDemo();
if (!demoMode && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error('Missing Supabase Environment Variables');
}

// Select once per document. Starting/exiting/resetting reloads the document, so
// in-flight real requests and cached real state cannot leak across session modes.
export const supabase = demoMode
  ? createDemoProvider(createIronLogSeed(), () => exitDemo()).client
  : createClient(supabaseUrl, supabaseAnonKey);
