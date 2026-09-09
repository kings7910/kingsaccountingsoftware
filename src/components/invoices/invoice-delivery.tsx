"use client";
import {useEffect,useState} from "react";
import {loadInvoiceDelivery,sendInvoiceEmail} from "@/app/actions/invoice-delivery";
import {invoiceEmailAddress} from "@/lib/invoice-document";
const message=(cause:unknown)=>cause instanceof Error?cause.message:"Unable to load invoice delivery.";
type Delivery=Awaited<ReturnType<typeof loadInvoiceDelivery>>;
export function InvoiceDelivery({companyId,invoiceId,onClose}:{companyId:string;invoiceId:string;onClose:()=>void}){
 const [details,setDetails]=useState<Delivery|null>(null),[recipient,setRecipient]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
 const [attempt,setAttempt]=useState<{id:string;recipient:string}|null>(null);
 useEffect(()=>{let active=true;loadInvoiceDelivery(companyId,invoiceId).then(value=>{if(active){setDetails(value);setRecipient(current=>current||value.recipient);setError("")}}).catch(cause=>{if(active)setError(message(cause))});return()=>{active=false}},[companyId,invoiceId,reload]);
 async function send(retry?:{id:string;recipient:string}){
  if(busy)return;
  let address:string;try{address=invoiceEmailAddress(retry?.recipient??attempt?.recipient??recipient)}catch(cause){setError(message(cause));return}
  const current=retry??attempt??{id:crypto.randomUUID(),recipient:address};setAttempt(current);setBusy(true);setError("");setNotice("");
  try{await sendInvoiceEmail(companyId,invoiceId,current.recipient,current.id);setNotice("Email accepted by the provider. This does not confirm delivery to the recipient.");setAttempt(null);setReload(x=>x+1)}catch(cause){setError(message(cause))}finally{setBusy(false)}
 }
 async function download(){setBusy(true);setError("");try{
  const response=await fetch(`/api/companies/${companyId}/invoices/${invoiceId}/pdf`);
  if(!response.ok){const body=await response.json();throw new Error(body.error||"Unable to download invoice.")}
  const url=URL.createObjectURL(await response.blob()),link=document.createElement("a");link.href=url;link.download=`${details?.number??"invoice"}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(cause){setError(message(cause))}finally{setBusy(false)}}
 return <div className="fixed inset-0 z-[70] grid place-items-end bg-black/40 p-2 sm:place-items-center"><section role="dialog" aria-modal="true" aria-label="Invoice document and email" className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6">
  <div className="flex items-center justify-between gap-3"><h2 className="display text-xl font-extrabold">Invoice document and email</h2><button type="button" disabled={busy} onClick={onClose} className="rounded-xl border px-3 py-2">Close</button></div>
  {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="mt-3 text-sm text-[var(--teal)]">{notice}</p>}
  {!details?<><p className="mt-4">{error?"Invoice details unavailable.":"Loading invoice…"}</p>{error&&<button type="button" className="mt-3 rounded-xl border px-3 py-2" onClick={()=>setReload(x=>x+1)}>Retry loading</button>}</>:<>
   <p className="mt-4 font-bold">{details.number}</p><button type="button" disabled={busy} onClick={()=>void download()} className="mt-3 rounded-xl border px-4 py-3 font-bold">Download PDF</button>
   <div className="mt-5 border-t pt-4"><h3 className="font-bold">Email a PDF copy</h3><p className="mt-2 text-sm text-[var(--muted)]">Review the recipient before sending. Sending an email does not record a payment.</p>
    {!details.configured&&<p className="mt-3 text-sm">An owner or administrator must connect a verified sender in Settings → Notifications.</p>}
    {!details.canSend&&<p className="mt-3 text-sm">Only issued, ledger-backed invoices can be emailed.</p>}
    {details.canSend&&details.configured&&<form onSubmit={event=>{event.preventDefault();void send()}} className="mt-3 space-y-3"><p className="break-all text-sm">From: {details.sender}</p><label className="block text-sm font-bold">Recipient email<input className="input" required type="email" value={attempt?.recipient??recipient} disabled={busy||!!attempt} onChange={event=>setRecipient(event.target.value)}/></label><button disabled={busy} className="rounded-xl bg-[var(--teal)] px-4 py-3 font-bold text-white disabled:opacity-50">{busy?"Working…":attempt?"Retry same email":"Send invoice email"}</button>{attempt&&<p className="text-xs">This attempt retains its recipient and PDF to prevent duplicate sends. Its history is also available after reopening this panel.</p>}</form>}
   </div>
   <h3 className="mt-5 font-bold">Recent email attempts</h3><p className="mt-1 text-xs text-[var(--muted)]">Latest 50 attempts. Accepted means the provider received the request; delivery and bounce tracking are not connected.</p>
   {!details.history.length&&<p className="mt-3 text-sm">No email attempts yet.</p>}
   <ul className="mt-3 space-y-3">{details.history.map(row=><li key={row.id} className="rounded-xl border p-3 text-sm"><p className="break-all font-bold">{row.recipient}</p><p>{new Date(row.created_at).toLocaleString()} · {row.status}</p>{row.last_error&&<p className="mt-1">{row.last_error}</p>}{row.status!=="accepted"&&<button type="button" disabled={busy} className="mt-2 rounded-lg border px-3 py-2" onClick={()=>void send({id:row.id,recipient:row.recipient})}>Retry this attempt</button>}</li>)}</ul>
  </>}
 </section></div>;
}
