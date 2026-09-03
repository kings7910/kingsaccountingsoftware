import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authRedirect } from "@/lib/auth-routing";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    const destination = authRedirect(request.nextUrl.pathname, false);
    return destination ? NextResponse.redirect(new URL(destination, request.url)) : response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const destination = authRedirect(request.nextUrl.pathname, Boolean(data?.claims && !error));
  if (!destination) return response;

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = destination;
  redirectUrl.search = "";
  const redirect = NextResponse.redirect(redirectUrl);
  response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
  return redirect;
}
