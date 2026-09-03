import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const integrations = {
    database: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    assistant: Boolean(process.env.OPENAI_API_KEY),
  };
  const ready = integrations.database;

  return NextResponse.json(
    {
      status: ready ? "ready" : "configuration_required",
      integrations,
      timestamp: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
