import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function ResetPasswordPage(){const supabase=await createClient();if(!supabase)redirect("/login");const{data,error}=await supabase.auth.getClaims();if(error||!data?.claims?.sub)redirect("/login");return <ResetPasswordForm/>}
