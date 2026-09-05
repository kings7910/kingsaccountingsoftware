"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, LockKeyhole, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

type Mode = "signin" | "signup" | "recovery";
const copy = {
  signin: { title: "Welcome back", description: "Sign in to your company workspace.", action: "Sign in", busy: "Signing in…" },
  signup: { title: "Create your account", description: "Start a secure workspace for your company.", action: "Create account", busy: "Creating account…" },
  recovery: { title: "Reset your password", description: "We’ll email you a secure recovery link.", action: "Send recovery link", busy: "Sending link…" },
} satisfies Record<Mode, { title: string; description: string; action: string; busy: string }>;

export default function LoginPage() {
  const router = useRouter();
  const [ready,setReady]=useState(false);
  useEffect(()=>setReady(true),[]);
  const [mode, setMode] = useState<Mode>("signin");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  function changeMode(next: Mode) { setMode(next); setMessage(""); setIsError(false); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setIsError(false);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const fullName = String(data.get("fullName") || "").trim();
    const supabase = createClient();
    if (!supabase) { setMessage("Demo mode: connect Supabase to use account features."); setIsError(true); setBusy(false); return; }

    if (mode === "recovery") {
      const redirectTo = `${window.location.origin}/auth/confirm?next=/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      setMessage(error?.message || "Check your email for a password recovery link."); setIsError(Boolean(error)); setBusy(false); return;
    }
    if (mode === "signup") {
      const { data: result, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding` } });
      if (error) { setMessage(error.message); setIsError(true); }
      else if (result.session) { router.push("/onboarding"); router.refresh(); }
      else setMessage("Account created. Check your email to confirm your address, then continue setup.");
      setBusy(false); return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMessage(error.message); setIsError(true); setBusy(false); return; }
    router.push("/workspace"); router.refresh();
  }

  const current = copy[mode];
  return <main className="min-h-screen bg-[var(--navy)] p-4 sm:grid sm:place-items-center"><div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-[1.05fr_1fr]">
    <section className="hidden bg-[#0f3a49] p-12 text-white lg:flex lg:flex-col"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-[var(--gold)] text-xl font-black text-[var(--navy)]">K</div><div className="display text-xl font-extrabold">King’s Accounting</div></div><div className="my-auto"><p className="text-sm font-bold uppercase tracking-[.18em] text-[#69cfbf]">Built for the road</p><h1 className="display mt-4 text-4xl font-extrabold leading-tight">Know your numbers.<br/>Run a stronger fleet.</h1><p className="mt-5 max-w-md text-white/65">Books, dispatch, drivers, documents, and fleet costs in one secure workspace.</p><div className="mt-9 space-y-4">{["Company-separated financial data","Private documents and receipts","Fine-grained team permissions"].map(item=><div className="flex items-center gap-3 text-sm font-semibold" key={item}><CheckCircle2 className="text-[#69cfbf]" size={19}/>{item}</div>)}</div></div><div className="flex items-center gap-2 text-xs text-white/45"><Truck size={16}/>Purpose-built for trucking businesses</div></section>
    <section className="p-7 sm:p-12"><div className="mb-9 lg:hidden"><div className="display text-xl font-extrabold text-[var(--navy)]">King’s Accounting</div></div><div className="grid size-12 place-items-center rounded-2xl bg-[var(--teal-light)] text-[var(--teal)]"><LockKeyhole/></div><h2 className="display mt-6 text-3xl font-extrabold text-[var(--navy)]">{current.title}</h2><p className="mt-2 text-sm text-[var(--muted)]">{current.description}</p>
      <form method="post" onSubmit={submit} className="mt-8 space-y-5">{mode==="signup"&&<label className="block text-sm font-bold">Full name<input disabled={!ready} name="fullName" required minLength={2} maxLength={100} autoComplete="name" className="mt-2 w-full rounded-xl border border-[var(--line)] p-3" placeholder="Your name"/></label>}<label className="block text-sm font-bold">Email address<input disabled={!ready} name="email" required type="email" autoComplete="email" className="mt-2 w-full rounded-xl border border-[var(--line)] p-3" placeholder="you@company.com"/></label>{mode!=="recovery"&&<label className="block text-sm font-bold">Password<input disabled={!ready} name="password" required minLength={8} type="password" autoComplete={mode==="signup"?"new-password":"current-password"} className="mt-2 w-full rounded-xl border border-[var(--line)] p-3" placeholder="At least 8 characters"/></label>}{message&&<p role={isError?"alert":"status"} className={`rounded-xl border p-3 text-sm ${isError?"border-red-200 bg-red-50 text-red-800":"border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{message}</p>}<button disabled={!ready||busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--teal)] p-3.5 font-bold text-white disabled:opacity-50">{busy?current.busy:current.action}<ArrowRight size={18}/></button></form>
      <div className="mt-5 space-y-3 text-center text-sm">{mode==="signin"&&<><button onClick={()=>changeMode("recovery")} className="font-bold text-[var(--teal)]">Forgot your password?</button><p className="text-[var(--muted)]">New to King’s? <button onClick={()=>changeMode("signup")} className="font-bold text-[var(--teal)]">Create an account</button></p></>}{mode!=="signin"&&<button onClick={()=>changeMode("signin")} className="font-bold text-[var(--teal)]">Back to sign in</button>}<Link href="/" className="block font-bold text-[var(--teal)]">Explore the demo workspace</Link></div>
    </section>
  </div></main>;
}
