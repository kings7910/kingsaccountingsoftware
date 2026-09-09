"use client";

import {useEffect,useState} from "react";
import {listPostingSources,postOperationalSource,type PostingSource} from "@/app/actions/operational-accounting";
import {listLedgerAccounts,type LedgerAccount} from "@/app/actions/finance-admin";

const money=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"});
export function OperationalPosting({companyId,onChange}:{companyId:string;onChange:()=>void}) {
  const [sources,setSources]=useState<PostingSource[]>([]),[accounts,setAccounts]=useState<LedgerAccount[]>([]);
  const [canPost,setCanPost]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
  const [selected,setSelected]=useState<PostingSource|null>(null),[mode,setMode]=useState<"expense"|"bill"|"invoice">("expense");
  const [date,setDate]=useState(""),[due,setDue]=useState(""),[cash,setCash]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
  useEffect(()=>{
    let active=true;
    Promise.all([listPostingSources(companyId),listLedgerAccounts(companyId)]).then(([result,ledger])=>{
      if(!active)return;
      setSources(result.sources);setCanPost(result.canPost);
      setAccounts(ledger.filter(a=>a.active&&a.type==="asset"&&a.number!=="1100"));
    }).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[companyId,reload]);
  function choose(source:PostingSource) {
    const today=new Date().toISOString().slice(0,10);
    setSelected(source);setMode(source.kind==="load"?"invoice":"expense");setDate(today);setDue(today);
    setCash(accounts.find(a=>a.number==="1000")?.id??accounts[0]?.id??"");setError("");setNotice("");
  }
  async function submit() {
    if(!selected||busy)return;
    setBusy(true);setError("");
    try {
      await postOperationalSource(companyId,selected,mode,date,due,cash);
      setNotice(mode==="invoice"?"Invoice issued and posted to receivables. Open Invoices to view it. No email has been sent.":mode==="bill"?"Bill posted to accounts payable. Open Vendor Bills to record payment.":"Paid expense posted to the ledger. Open Transactions to view it.");
      setSelected(null);setReload(x=>x+1);onChange();
    }catch(e){setError(e instanceof Error?e.message:"Unable to post source.")}
    finally{setBusy(false)}
  }
  return <section className="card my-6 p-5" aria-label="Operational posting">
    <h2 className="text-xl font-extrabold">Operational posting</h2>
    <p className="mt-1 text-sm text-[var(--muted)]">Post approved fuel and completed maintenance as paid expenses or unpaid bills. Issue invoices for delivered loads. Each source can be posted once; use accounting corrections afterward.</p>
    {error&&<p role="alert" className="mt-3 text-red-700">{error}</p>}
    {notice&&<p role="status" className="mt-3 text-[var(--teal)]">{notice}</p>}
    {loading?<p className="mt-4">Loading sources…</p>:sources.length===0?<p className="mt-4 text-sm">No approved fuel, completed maintenance, or delivered loads yet.</p>:<div className="mt-4 max-h-96 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Source</th><th className="p-2">Date</th><th className="p-2 text-right">Amount</th><th className="p-2">Accounting</th></tr></thead><tbody>{sources.map(source=><tr key={`${source.kind}-${source.id}`} className="border-t"><td className="p-2"><span className="capitalize">{source.kind}</span><p className="font-bold">{source.reference}</p></td><td className="p-2">{source.date||"—"}</td><td className="p-2 text-right">{money.format(source.amount)}</td><td className="p-2">{source.posted??(canPost?<button disabled={busy||source.amount<=0} onClick={()=>choose(source)} className="rounded-lg border px-3 py-2">{source.kind==="load"?"Issue invoice":"Post cost"}</button>:"Awaiting finance posting")}</td></tr>)}</tbody></table></div>}
    {selected&&<form className="mt-5 rounded-xl border p-4" onSubmit={e=>{e.preventDefault();void submit()}}>
      <h3 className="font-bold">{selected.reference} · {money.format(selected.amount)}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {selected.kind!=="load"&&<label>Post as<select disabled={busy} className="input" value={mode} onChange={e=>setMode(e.target.value as "expense"|"bill")}><option value="expense">Paid expense</option><option value="bill">Unpaid vendor bill</option></select></label>}
        <label>Posting date<input disabled={busy} required className="input" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
        {mode==="expense"?<label>Paid from<select disabled={busy} required className="input" value={cash} onChange={e=>setCash(e.target.value)}><option value="">Choose cash or bank account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.number} · {a.name}</option>)}</select></label>:<label>Due date<input disabled={busy} required min={date} className="input" type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>}
      </div>
      <div className="mt-4 flex gap-3"><button disabled={busy} className="rounded-xl bg-[var(--teal)] px-4 py-2 font-bold text-white">{busy?"Posting…":mode==="invoice"?"Confirm invoice":"Confirm cost posting"}</button><button disabled={busy} type="button" className="rounded-xl border px-4 py-2" onClick={()=>setSelected(null)}>Cancel</button></div>
    </form>}
  </section>;
}
