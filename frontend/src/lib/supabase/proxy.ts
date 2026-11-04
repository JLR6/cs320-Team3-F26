import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // make a new client for each request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // keep this path next to getClaims to avoid random logouts

  // keep getClaims for stable server-rendered sessions
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // add public routes here when they need no auth
  if (
    !user &&
    request.nextUrl.pathname !== '/' &&
    request.nextUrl.pathname !== '/feed' &&
    request.nextUrl.pathname !== '/login' &&
    request.nextUrl.pathname !== '/signup' &&
    request.nextUrl.pathname !== '/forgotPass' &&
    request.nextUrl.pathname !== '/callback'
  ) {
    // send guests to login for protected routes
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // send logged-in users from auth pages to the feed
  if (
    user &&
    (request.nextUrl.pathname === '/login' ||
      request.nextUrl.pathname === '/signup')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/feed';
    url.search = '';
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  // return this response so refreshed cookies reach the browser

  return supabaseResponse;
}
