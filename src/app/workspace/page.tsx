import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const { data: claimsData, error } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (error || typeof userId !== "string") redirect("/login");

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase.from("company_memberships").select("company_id, role, companies(display_name)").eq("user_id", userId).eq("is_active", true).limit(1).maybeSingle(),
  ]);

  if (!membership) redirect("/onboarding");
  if (membership.role === "driver") redirect("/driver");

  const company = Array.isArray(membership?.companies) ? membership.companies[0] : membership?.companies;
  return <AppShell authenticated assistantEnabled={Boolean(process.env.OPENAI_API_KEY)} userId={userId} companyId={membership.company_id} userName={profile?.full_name || "Account user"} role={membership?.role || "member"} companyName={company?.display_name || "Your company"}/>;
}
