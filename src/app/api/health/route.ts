import { NextResponse } from "next/server";
import {probeSupabase} from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase=await probeSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const integrations = {
    database: supabase.database,
    auth: supabase.auth,
    assistant: Boolean(process.env.OPENAI_API_KEY),
  };
  const ready = integrations.database && integrations.auth;

  return NextResponse.json(
    {
      status: ready ? "ready" : "configuration_required",
      integrations,
      latencyMs: supabase.latencyMs,
      ...(supabase.error?{error:supabase.error}:{}),
      timestamp: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
