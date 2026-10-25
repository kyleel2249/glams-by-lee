import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/** /admin, /account and /auth only: keep the Supabase session fresh and keep these areas out of search engines and caches. Pages and actions still check access themselves. */
export async function middleware(req: NextRequest) {
  // Pass the requested path to server components (a layout cannot see it otherwise), so sign-in can return people to the right page.
  const forwarded = new Headers(req.headers);
  forwarded.set('x-pathname', req.nextUrl.pathname + req.nextUrl.search);
  let res = NextResponse.next({ request: { headers: forwarded } });
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  res.headers.set('Cache-Control', 'no-store');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('YOUR-PROJECT')) return res;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: { headers: forwarded } });
        res.headers.set('X-Robots-Tag', 'noindex, nofollow'); res.headers.set('Cache-Control', 'no-store');
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return res;
}
export const config = { matcher: ['/admin/:path*', '/account/:path*', '/auth/:path*'] };
