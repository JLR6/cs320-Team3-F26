import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // build a browser client for auth calls
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
