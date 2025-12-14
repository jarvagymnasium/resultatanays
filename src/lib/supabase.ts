import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Use environment variables for security
// Create a .env.local file with these values (see env.example)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a mock client for build time when env vars are not available
let supabase: SupabaseClient;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  // During build or when env vars are missing, create a placeholder
  // This will show warnings at runtime but won't crash the build
  console.warn('⚠️ Missing Supabase environment variables. Please check .env.local');
  
  // Create with placeholder values - will fail at runtime but not at build
  supabase = createClient(
    'https://placeholder.supabase.co',
    'placeholder-key'
  );
}

export { supabase };
