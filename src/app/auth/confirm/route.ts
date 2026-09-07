import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeAuthDestination } from "@/lib/auth-routing";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const destination = safeAuthDestination(request.nextUrl.searchParams.get("next"));
  if (!supabase) return NextResponse.redirect(new URL("/login?error=configuration", request.url));
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const result = code ? await supabase.auth.exchangeCodeForSession(code) : tokenHash && type ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type }) : { error: new Error("Missing confirmation token") };
  return NextResponse.redirect(new URL(result.error ? "/login?error=confirmation" : destination, request.url));
}
