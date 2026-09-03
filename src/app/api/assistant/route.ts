import { NextResponse } from "next/server";
import { z } from "zod";
import { askAccountingAssistant } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({ question: z.string().trim().min(2).max(2_000) });

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase.auth.getClaims();
      if (error || !data?.claims?.sub) return NextResponse.json({ error: "Please sign in to use the assistant." }, { status: 401 });
    } else if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter a question between 2 and 2,000 characters." }, { status: 400 });

    return NextResponse.json({ answer: await askAccountingAssistant(parsed.data.question) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The assistant is temporarily unavailable.";
    const configurationError = message.startsWith("OpenAI is not configured");
    return NextResponse.json({ error: message }, { status: configurationError ? 503 : 502 });
  }
}
