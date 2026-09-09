import { redirect } from "next/navigation";
import { CompanyOnboarding } from "@/components/onboarding/company-onboarding";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const { data: claimsData, error } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (error || typeof userId !== "string") redirect("/login");

  const [{ data: profile, error: profileError }, { data: membership, error: membershipError }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase.from("company_memberships").select("id").eq("user_id", userId).eq("is_active", true).limit(1).maybeSingle(),
  ]);

  if (profileError || membershipError) throw new Error("Unable to check your workspace. Please try again.");
  if (membership) redirect("/workspace");
  return <CompanyOnboarding userName={profile?.full_name || "there"}/>;
}
