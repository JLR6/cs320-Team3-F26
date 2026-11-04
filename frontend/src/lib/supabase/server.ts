import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * create a fresh client per server function
 * avoid sharing clients with fluid compute
 */
export async function createClient() {
  // bind auth state to the request cookies
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // server comps cannot write cookies; the proxy refreshes sessions
          }
        },
      },
    },
  );
}
