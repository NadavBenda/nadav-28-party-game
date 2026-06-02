import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Server-side Supabase client (service role key, bypasses RLS)
// Only used in Server Actions and API routes — never exposed to the browser
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
