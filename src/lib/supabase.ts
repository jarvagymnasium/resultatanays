import { createClient } from '@supabase/supabase-js';

// Environment variables (set in .env.local or Vercel)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fykxvhrlkjltgqsksyoz.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5a3h2aHJsa2psdGdxc2tzeW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI5MDYxNzYsImV4cCI6MjA1ODQ4MjE3Nn0.p-tE7MS2vPH0RNlW5U5t_A_UkLHEtMwZVxyHwQX6Sns';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
