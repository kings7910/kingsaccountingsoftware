"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function CompanyOnboarding({ userName }: { userName: string }) {
  const router = useRouter();
  const [ready,setReady]=useState(false);
  useEffect(()=>setReady(true),[]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName") || "").trim();
    const legalName = String(form.get("legalName") || "").trim();
    const supabase = createClient();

    if (!supabase) {
      setError("Database configuration is unavailable.");
      setBusy(false);
      return;
    }

    const { error: requestError } = await supabase.rpc("create_company_workspace", {
      company_display_name: displayName,
      company_legal_name: legalName || displayName,
    });

    if (requestError) {
      setError(requestError.message);
      setBusy(false);
      return;
    }

    router.push("/workspace");
    router.refresh();
  }

  return <main className="min-h-screen bg-[var(--navy)] p-4 sm:grid sm:place-items-center">
    <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-[.9fr_1.1fr]">
      <section className="hidden bg-[#0f3a49] p-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-[var(--gold)] text-xl font-black text-[var(--navy)]">K</div><div className="display text-xl font-extrabold">King’s Accounting</div></div>
        <div className="my-auto"><p className="text-sm font-bold uppercase tracking-[.18em] text-[#69cfbf]">One last step</p><h1 className="display mt-4 text-4xl font-extrabold leading-tight">Build your company workspace.</h1><p className="mt-5 text-white/65">Your financial and fleet records stay separated from every other company.</p><div className="mt-9 space-y-4">{["You become the workspace owner","Invite your team later","Change company settings anytime"].map(item=><div key={item} className="flex items-center gap-3 text-sm font-semibold"><CheckCircle2 className="text-[#69cfbf]" size={19}/>{item}</div>)}</div></div>
      </section>
      <section className="p-7 sm:p-12"><div className="grid size-12 place-items-center rounded-2xl bg-[var(--teal-light)] text-[var(--teal)]"><Building2/></div><p className="mt-6 text-sm font-bold text-[var(--teal)]">Welcome, {userName}</p><h2 className="display mt-2 text-3xl font-extrabold text-[var(--navy)]">Set up your company</h2><p className="mt-2 text-sm text-[var(--muted)]">Enter the business name your team should see.</p>
        <form method="post" onSubmit={submit} className="mt-8 space-y-5"><label className="block text-sm font-bold">Company display name<input disabled={!ready} name="displayName" required minLength={2} maxLength={120} autoFocus className="mt-2 w-full rounded-xl border border-[var(--line)] p-3" placeholder="King’s Transport LLC"/></label><label className="block text-sm font-bold">Legal business name <span className="font-normal text-[var(--muted)]">(optional)</span><input disabled={!ready} name="legalName" maxLength={180} className="mt-2 w-full rounded-xl border border-[var(--line)] p-3" placeholder="Defaults to the display name"/></label>{error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}<button disabled={!ready||busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--teal)] p-3.5 font-bold text-white disabled:opacity-50">{busy?"Creating workspace…":"Create workspace"}<ArrowRight size={18}/></button></form>
      </section>
    </div>
  </main>;
}
