"use client";

import { FormEvent, useState } from "react";
import { Bot, CircleAlert, Send, Sparkles } from "lucide-react";

const suggestions = [
  "What should I review before closing the month?",
  "Explain the difference between cash flow and profit.",
  "Create a checklist for reviewing driver fuel receipts.",
];

export function AssistantWorkspace({enabled}:{enabled:boolean}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (question.trim().length < 2 || loading) return;
    setLoading(true);
    setError("");
    setAnswer("");
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const data = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !data.answer) throw new Error(data.error || "The assistant could not answer.");
      setAnswer(data.answer);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The assistant is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
    <section className="card p-5 md:p-7">
      <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-[var(--teal-light)] text-[var(--teal)]"><Bot size={22}/></div><div><h2 className="display text-xl font-extrabold text-[var(--navy)]">Ask King’s AI</h2><p className="text-sm text-[var(--muted)]">Guidance for bookkeeping and trucking operations</p></div></div>
      {!enabled&&<div role="status" className="mt-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><CircleAlert className="mt-0.5 shrink-0" size={18}/><div><b className="block">Assistant setup is incomplete</b><span>The workspace administrator needs to add the server-side OpenAI API key. Your other accounting tools remain available.</span></div></div>}
      <form onSubmit={submit} className="mt-6"><label className="text-sm font-bold" htmlFor="assistant-question">Your question</label><textarea disabled={!enabled} id="assistant-question" value={question} onChange={(event)=>setQuestion(event.target.value)} maxLength={2000} rows={5} className="mt-2 w-full resize-y rounded-2xl border border-[var(--line)] p-4 text-sm disabled:cursor-not-allowed disabled:bg-[var(--canvas)] disabled:text-[var(--muted)]" placeholder={enabled?"Ask about reconciliation, invoices, expenses, mileage, or month-end tasks…":"Assistant unavailable until setup is complete"}/><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-[var(--muted)]">{question.length}/2,000</span><button disabled={!enabled||loading||question.trim().length<2} className="flex items-center gap-2 rounded-xl bg-[var(--teal)] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Send size={16}/>{loading?"Thinking…":"Ask assistant"}</button></div></form>
      {error&&<div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {answer&&<div aria-live="polite" className="mt-5 rounded-2xl bg-[var(--canvas)] p-5"><p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[var(--teal)]"><Sparkles size={15}/>Assistant response</p><p className="whitespace-pre-wrap text-sm leading-7">{answer}</p></div>}
    </section>
    <aside className="card p-5 md:p-6"><h2 className="display text-lg font-extrabold text-[var(--navy)]">Try asking</h2><div className="mt-4 space-y-2">{suggestions.map((suggestion)=><button disabled={!enabled} key={suggestion} onClick={()=>setQuestion(suggestion)} className="w-full rounded-xl border border-[var(--line)] p-3 text-left text-sm font-semibold hover:border-[var(--teal)] hover:bg-[var(--teal-light)] disabled:cursor-not-allowed disabled:opacity-50">{suggestion}</button>)}</div><p className="mt-5 text-xs leading-5 text-[var(--muted)]">AI responses can be inaccurate. Verify accounting, payroll, tax, and compliance decisions with a qualified professional.</p></aside>
  </div>;
}
