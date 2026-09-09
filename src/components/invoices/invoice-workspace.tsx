"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FileText, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { demoInvoices, Invoice, invoiceAmount, invoiceBalance, InvoiceDraft, invoiceStatuses, InvoiceCursor, InvoiceAllocationDraft, nextInvoiceNumber, validateInvoice, validateInvoiceAllocation } from "@/lib/invoices";
import { deleteInvoice, listInvoices, saveInvoice, recordInvoiceAllocation, recordInvoiceCorrection, listInvoicePaymentAccounts, loadInvoiceDefaults } from "@/app/actions/invoices";
import {InvoiceTemplateEditor} from "./invoice-template-editor";
import {InvoiceDelivery} from "./invoice-delivery";
const storageKey="kings-invoices-v1",currency=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"});
const newItem=()=>({id:crypto.randomUUID(),description:"",quantity:1,unitPrice:0,taxRate:0});
const blank=():InvoiceDraft=>({customer:"",issuedOn:new Date().toISOString().slice(0,10),dueOn:"",status:"Draft",notes:"",items:[newItem()]});
const message=(cause:unknown)=>cause instanceof Error?cause.message:"Unable to complete this request.";
export function InvoiceWorkspace({openCreate,onCreateClosed,companyId}:{openCreate:boolean;onCreateClosed:()=>void;companyId?:string}){
 const [records,setRecords]=useState<Invoice[]>(companyId?[]:demoInvoices),[loadedKey,setLoadedKey]=useState(companyId?"":"demo"),[loaded,setLoaded]=useState(false);
 const [templateOpen,setTemplateOpen]=useState(false);
 const [delivery,setDelivery]=useState<string|null>(null);
 const [query,setQuery]=useState(""),[status,setStatus]=useState("All statuses"),[editing,setEditing]=useState<Invoice|null>(null),[allocation,setAllocation]=useState<{invoice:Invoice;kind:"payment"|"credit"|"refund"|"reversal";paymentId?:string}|null>(null);
 const [error,setError]=useState(""),[busy,setBusy]=useState(false),[reload,setReload]=useState(0),[cursor,setCursor]=useState<InvoiceCursor|null>(null);
 useEffect(()=>{let active=true;if(companyId){listInvoices(companyId).then(page=>{if(active){setRecords(page.items);setCursor(page.nextCursor);setError("");setLoadedKey(companyId)}}).catch(cause=>{if(active)setError(message(cause))}).finally(()=>{if(active)setLoaded(true)});return()=>{active=false}}
  try{const value=localStorage.getItem(storageKey);if(value)setRecords(JSON.parse(value) as Invoice[])}catch{}setLoaded(true);
 },[companyId,reload]);
 useEffect(()=>{if(loaded&&!companyId)localStorage.setItem(storageKey,JSON.stringify(records))},[loaded,records,companyId]);
 const visible=useMemo(()=>{const term=query.toLowerCase().trim();return records.filter(x=>(status==="All statuses"||x.status===status)&&(!term||`${x.number} ${x.customer}`.toLowerCase().includes(term)))},[query,records,status]);
 async function save(draft:InvoiceDraft,id:string|undefined,requestId:string){
  const saved=companyId?await saveInvoice(companyId,draft,id,requestId):{...draft,id:id??crypto.randomUUID(),number:id?records.find(x=>x.id===id)!.number:nextInvoiceNumber(records)};
  setRecords(current=>id?current.map(x=>x.id===id?saved:x):[saved,...current]);setEditing(null);onCreateClosed();
 }
 async function remove(invoice:Invoice){if(invoice.status!=="Draft"||busy||!confirm(`Delete ${invoice.number}?`))return;setBusy(true);try{if(companyId)await deleteInvoice(companyId,invoice.id);setRecords(current=>current.filter(x=>x.id!==invoice.id));setError("")}catch(cause){setError(message(cause))}finally{setBusy(false)}}
 async function loadMore(){if(!companyId||!cursor||busy)return;setBusy(true);try{const page=await listInvoices(companyId,cursor);setRecords(current=>[...current,...page.items.filter(item=>!current.some(x=>x.id===item.id))]);setCursor(page.nextCursor);setError("")}catch(cause){setError(message(cause))}finally{setBusy(false)}}
 if(companyId&&loadedKey!==companyId)return <div className="card p-5" role={error?"alert":"status"}>{error||"Loading invoices…"}{error&&<button className="ml-3 rounded-xl border px-3 py-2" onClick={()=>setReload(x=>x+1)}>Retry</button>}</div>;
 if(templateOpen&&companyId&&!openCreate)return <InvoiceTemplateEditor key={companyId} companyId={companyId} onBack={()=>setTemplateOpen(false)}/>;
 return <>
  {companyId&&<div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white p-4"><div><p className="font-bold">Your invoice design</p><p className="text-sm text-[var(--muted)]">Customize your business information, logo, and PDF template.</p></div><button type="button" onClick={()=>setTemplateOpen(true)} className="rounded-xl border px-4 py-3 text-sm font-bold">Invoice template</button></div>}
  {error&&<p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  <div className="flex flex-wrap gap-2"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17}/><input aria-label="Search invoices" value={query} onChange={e=>setQuery(e.target.value)} className="w-full rounded-xl border border-[var(--line)] py-2.5 pl-10 pr-3 text-sm" placeholder="Search loaded invoices or customers…"/></div><select aria-label="Invoice status filter" value={status} onChange={e=>setStatus(e.target.value)} className="rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-bold"><option>All statuses</option>{invoiceStatuses.map(x=><option key={x} value={x}>{x==="Sent"?"Issued":x}</option>)}</select></div>
  {companyId&&<p className="mt-2 text-xs text-[var(--muted)]">{records.length} invoices loaded. Search and filters cover loaded invoices.</p>}
  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(invoice=>{const balance=invoiceBalance(invoice),legacy=companyId&&invoice.ledgerManaged===false;return <article className="card p-5" key={invoice.id}>
   <div className="flex items-start justify-between"><FileText className="text-[var(--teal)]" size={22}/><span className="pill bg-[var(--canvas)]">{invoice.status==="Sent"?"Issued":invoice.status}</span></div>
   <p className="mt-5 text-xs font-bold text-[var(--teal)]">{invoice.number}</p><h2 className="mt-1 truncate font-extrabold">{invoice.customer}</h2><p className="mt-1 text-xs text-[var(--muted)]">Due {invoice.dueOn}</p>
   <strong className="display mt-4 block text-xl">{currency.format(invoice.total??invoiceAmount(invoice))}</strong>
   <p className="mt-1 text-sm">{balance<0?"Customer credit":"Outstanding"}: {currency.format(Math.abs(balance))}</p>
   {invoice.journalNumber&&<p className="mt-1 text-xs text-[var(--teal)]">Posted {invoice.journalNumber}</p>}
   {legacy&&<p className="mt-3 text-sm text-amber-800">Legacy invoice: reconcile existing journals with your accountant before making changes.</p>}
   <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
    {companyId&&<button className="rounded-lg border px-3 py-2 text-xs font-bold" onClick={()=>setDelivery(invoice.id)}>PDF / email</button>}
    {!legacy&&invoice.status==="Draft"&&<><button disabled={busy} onClick={()=>setEditing(invoice)} aria-label={`Edit ${invoice.number}`} className="rounded-lg border p-2"><Pencil size={16}/></button><button disabled={busy} onClick={()=>void remove(invoice)} aria-label={`Delete ${invoice.number}`} className="rounded-lg border p-2"><Trash2 size={16}/></button></>}
    {companyId&&!legacy&&invoice.journalNumber&&<>{balance<0&&<button className="rounded-lg border px-3 py-2 text-xs font-bold" onClick={()=>setAllocation({invoice,kind:"refund"})}>Record refund</button>}{balance>0&&<button className="rounded-lg bg-[var(--teal)] px-3 py-2 text-xs font-bold text-white" onClick={()=>setAllocation({invoice,kind:"payment"})}>Record payment</button>}{(invoice.credits??[]).reduce((n,x)=>n+x.amount,0)<(invoice.total??invoiceAmount(invoice))&&<button className="rounded-lg border px-3 py-2 text-xs font-bold" onClick={()=>setAllocation({invoice,kind:"credit"})}>Credit note</button>}</>}
   </div>
   <details className="mt-3 text-sm"><summary className="cursor-pointer font-bold">Invoice details and history</summary><ul className="mt-2 space-y-1">{invoice.items.map(item=><li key={item.id}>{item.description} · {item.quantity} × {currency.format(item.unitPrice)}</li>)}</ul>{invoice.notes&&<p className="mt-2">{invoice.notes}</p>}{invoice.payments?.map(x=><p className="mt-2" key={x.id}>{x.date} · Payment {currency.format(x.amount)} · {x.reference} · {x.journalNumber}{!legacy&&x.accountId&&!invoice.adjustments?.some(a=>a.paymentId===x.id)&&<button className="ml-2 rounded border px-2 py-1" onClick={()=>setAllocation({invoice,kind:"reversal",paymentId:x.id})}>Reverse payment</button>}</p>)}{invoice.adjustments?.map(x=><p className="mt-2" key={x.id}>{x.date} · {x.kind} {currency.format(x.amount)} · {x.reason} · {x.journalNumber}</p>)}{invoice.credits?.map(x=><p className="mt-2" key={x.id}>{x.date} · Credit {currency.format(x.amount)} · {x.reason} · {x.journalNumber}</p>)}</details>
  </article>})}</div>
  {!visible.length&&<p className="card mt-4 p-8 text-center">No invoices found in the loaded records.</p>}
  {cursor&&<button disabled={busy} onClick={()=>void loadMore()} className="mt-4 rounded-xl border px-4 py-3 font-bold">{busy?"Loading…":"Load older invoices"}</button>}
  {delivery&&companyId&&<InvoiceDelivery key={`${companyId}/${delivery}`} companyId={companyId} invoiceId={delivery} onClose={()=>setDelivery(null)}/>}
  {(openCreate||editing)&&<InvoiceForm companyId={companyId} invoice={editing} onCancel={()=>{setEditing(null);onCreateClosed()}} onSave={save}/>}
  {allocation&&companyId&&<AllocationForm invoice={allocation.invoice} kind={allocation.kind} paymentId={allocation.paymentId} companyId={companyId} onClose={()=>setAllocation(null)} onSaved={saved=>{setRecords(current=>current.map(x=>x.id===saved.id?saved:x));setAllocation(null)}}/>}
 </>;
}
function AllocationForm({invoice,kind,paymentId,companyId,onClose,onSaved}:{invoice:Invoice;kind:"payment"|"credit"|"refund"|"reversal";paymentId?:string;companyId:string;onClose:()=>void;onSaved:(invoice:Invoice)=>void}){
 const payment=invoice.payments?.find(x=>x.id===paymentId);
 const correction=kind==="refund"||kind==="reversal";
 const needsAccount=kind==="payment"||kind==="refund";
 const [draft,setDraft]=useState<InvoiceAllocationDraft>(()=>({date:new Date().toISOString().slice(0,10),amount:kind==="reversal"?payment?.amount??0:kind==="refund"?Math.max(0,-invoiceBalance(invoice)):Math.max(0,invoiceBalance(invoice)),reference:"",accountId:payment?.accountId??"",requestId:crypto.randomUUID()}));
 const [accounts,setAccounts]=useState<{id:string;label:string}[]>([]),[accountsLoaded,setAccountsLoaded]=useState(!needsAccount),[saving,setSaving]=useState(false),[error,setError]=useState("");
 useEffect(()=>{if(!needsAccount)return;let active=true;listInvoicePaymentAccounts(companyId).then(result=>{if(active){setAccounts(result);setAccountsLoaded(true)}}).catch(cause=>{if(active)setError(message(cause))});return()=>{active=false}},[companyId,needsAccount]);
 const patch=(value:Partial<InvoiceAllocationDraft>)=>setDraft(current=>({...current,...value}));
 async function submit(event:FormEvent){event.preventDefault();if(saving)return;const errors=correction?{}:validateInvoiceAllocation(draft,invoice,kind);if(Object.keys(errors).length){setError(Object.values(errors)[0]);return}setSaving(true);setError("");try{onSaved(correction?await recordInvoiceCorrection(companyId,invoice.id,kind,draft,paymentId):await recordInvoiceAllocation(companyId,invoice.id,kind,draft))}catch(cause){setError(message(cause))}finally{setSaving(false)}}
 const title=kind==="payment"?"Record customer payment":kind==="refund"?"Record customer refund":kind==="reversal"?"Reverse customer payment":"Create credit note";
 return <div className="fixed inset-0 z-[70] grid place-items-end bg-black/40 p-2 sm:place-items-center"><form role="dialog" aria-modal="true" aria-label={title} onSubmit={submit} className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6">
  <h2 className="display text-2xl font-extrabold">{title}</h2><p className="mt-2 text-sm">{invoice.number} · {invoice.customer}</p>
  <p className="mt-2 text-sm text-[var(--muted)]">This records a dated entry in the books. {kind==="credit"?"Credits after payment remain as a customer credit balance.":"No money is transferred."}</p>
  <fieldset disabled={saving} className="mt-5 space-y-4">
   <label className="block text-sm font-bold">{kind==="payment"?"Payment date":correction?"Correction date":"Credit date"}<input className="input" required type="date" min={invoice.issuedOn} max={new Date().toISOString().slice(0,10)} value={draft.date} onChange={e=>patch({date:e.target.value})}/></label>
   <label className="block text-sm font-bold">Amount<input className="input" readOnly={kind==="reversal"} required type="number" min="0.01" step="0.01" value={draft.amount||""} onChange={e=>patch({amount:Number(e.target.value)})}/></label>
   {needsAccount&&<label className="block text-sm font-bold">Deposit account<select className="input" required value={draft.accountId} onChange={e=>patch({accountId:e.target.value})}><option value="">Choose cash or bank account</option>{accounts.map(x=><option value={x.id} key={x.id}>{x.label}</option>)}</select></label>}
   {needsAccount&&accountsLoaded&&!accounts.length&&<p className="text-sm">Add a bank account in Transactions → Bank reconciliation, then reopen this payment form.</p>}
   <label className="block text-sm font-bold">{kind==="payment"?"Payment reference":correction?"Correction reason":"Credit reason"}<input className="input" required={kind!=="payment"} value={draft.reference} onChange={e=>patch({reference:e.target.value})}/></label>
  </fieldset>
  {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error} If the response was lost, retry with the same details.</p>}
  <div className="mt-6 flex justify-end gap-2"><button disabled={saving} type="button" onClick={onClose} className="rounded-xl border px-4 py-3">Cancel</button><button disabled={saving||!accountsLoaded||(needsAccount&&!accounts.length)} className="rounded-xl bg-[var(--teal)] px-4 py-3 font-bold text-white disabled:opacity-50">{saving?"Saving…":kind==="payment"?"Save payment":correction?"Save correction":"Save credit note"}</button></div>
 </form></div>;
}
function InvoiceForm({invoice,companyId,onCancel,onSave}:{invoice:Invoice|null;companyId?:string;onCancel:()=>void;onSave:(draft:InvoiceDraft,id:string|undefined,requestId:string)=>Promise<void>}){
 const [draft,setDraft]=useState<InvoiceDraft>(()=>invoice?{customer:invoice.customer,issuedOn:invoice.issuedOn,dueOn:invoice.dueOn,status:invoice.status,notes:invoice.notes,items:invoice.items}:blank());
 const [errors,setErrors]=useState<Record<string,string>>({}),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState(""),[requestId]=useState(()=>crypto.randomUUID());
 useEffect(()=>{if(!companyId||invoice)return;let active=true;loadInvoiceDefaults(companyId).then(({paymentTerms})=>{if(active)setDraft(current=>{if(current.dueOn)return current;const due=new Date(`${current.issuedOn}T00:00:00Z`);due.setUTCDate(due.getUTCDate()+paymentTerms);return {...current,dueOn:due.toISOString().slice(0,10)}})}).catch(cause=>{if(active)setSaveError(message(cause))});return()=>{active=false}},[companyId,invoice]);
 const patch=(value:Partial<InvoiceDraft>)=>setDraft(x=>({...x,...value}));
 const line=(id:string,value:Partial<InvoiceDraft["items"][number]>)=>setDraft(current=>({...current,items:current.items.map(x=>x.id===id?{...x,...value}:x)}));
 async function submit(event:FormEvent){event.preventDefault();if(saving)return;const found=validateInvoice(draft);setErrors(found);if(Object.keys(found).length)return;setSaving(true);setSaveError("");try{await onSave(draft,invoice?.id,requestId)}catch(cause){setSaveError(message(cause))}finally{setSaving(false)}}
 return <div className="fixed inset-0 z-[70] grid place-items-end bg-black/40 p-2 sm:place-items-center"><form role="dialog" aria-modal="true" aria-label="Invoice form" onSubmit={submit} className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6">
  <div className="flex items-center justify-between"><div><p className="text-xs font-bold text-[var(--teal)]">Accounts receivable</p><h2 className="display text-2xl font-extrabold">{invoice?`Edit ${invoice.number}`:"New invoice"}</h2></div><button type="button" disabled={saving} aria-label="Close invoice form" onClick={onCancel} className="rounded-xl border p-2"><X/></button></div>
  <fieldset disabled={saving}>
   <div className="mt-5 grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-bold sm:col-span-2">Customer<input required value={draft.customer} onChange={e=>patch({customer:e.target.value})} className="input" placeholder="Customer name"/></label>
    <label className="text-sm font-bold">Issue date<input required type="date" value={draft.issuedOn} onChange={e=>patch({issuedOn:e.target.value})} className="input"/></label>
    <label className="text-sm font-bold">Due date<input required type="date" min={draft.issuedOn} value={draft.dueOn} onChange={e=>patch({dueOn:e.target.value})} className="input"/></label>
   </div>
   <div className="mt-5 flex justify-between"><h3 className="font-extrabold">Line items</h3><button type="button" onClick={()=>patch({items:[...draft.items,newItem()]})} className="flex items-center gap-1 text-sm font-bold text-[var(--teal)]"><Plus size={16}/>Add line</button></div>
   {draft.items.map((item,index)=><div key={item.id} className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-[var(--line)] p-3 sm:grid-cols-3">
    <label className="col-span-2 text-xs font-bold sm:col-span-3">Line {index+1} description<input required value={item.description} onChange={e=>line(item.id,{description:e.target.value})} className="input"/></label>
    <label className="text-xs font-bold">Quantity<input required type="number" min="0.001" step="0.001" value={item.quantity} onChange={e=>line(item.id,{quantity:Number(e.target.value)})} className="input"/></label>
    <label className="text-xs font-bold">Unit price<input required type="number" min="0" step="0.01" value={item.unitPrice||""} onChange={e=>line(item.id,{unitPrice:Number(e.target.value)})} className="input"/></label>
    <label className="text-xs font-bold">Tax rate (%)<input type="number" min="0" step="0.0001" value={Math.round(item.taxRate*1e6)/1e4} onChange={e=>line(item.id,{taxRate:Number(e.target.value)/100})} className="input"/></label>
    <button type="button" aria-label={`Remove line ${index+1}`} disabled={draft.items.length===1} onClick={()=>patch({items:draft.items.filter(x=>x.id!==item.id)})} className="w-fit rounded-lg border p-2 text-[var(--muted)] disabled:opacity-30"><Trash2 size={17}/></button>
   </div>)}
   <label className="mt-4 block text-sm font-bold">Notes<textarea value={draft.notes} onChange={e=>patch({notes:e.target.value})} className="input"/></label>
   <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded-xl bg-[var(--canvas)] p-4"><label className="text-sm font-bold">Status<select value={draft.status} onChange={e=>patch({status:e.target.value as InvoiceDraft["status"]})} className="input"><option value="Draft">Draft</option><option value="Sent">Issued</option></select></label><div><p className="text-xs">Invoice total</p><strong className="display text-2xl">{currency.format(invoiceAmount(draft))}</strong></div></div>
  </fieldset>
  <p className="mt-3 text-sm text-[var(--muted)]">Issuing posts this invoice to the books and locks its lines. Email delivery is separate.</p>
  {Object.entries(errors).map(([key,value])=><p role="alert" className="mt-2 text-sm text-red-700" key={key}>{value}</p>)}
  {saveError&&<p role="alert" className="mt-3 text-sm text-red-700">{saveError} If the response was lost, retry with the same details.</p>}
  <div className="mt-6 flex justify-end gap-2"><button type="button" disabled={saving} onClick={onCancel} className="rounded-xl border px-4 py-3">Cancel</button><button disabled={saving} className="rounded-xl bg-[var(--teal)] px-5 py-3 font-bold text-white disabled:opacity-50">{saving?"Saving…":"Save invoice"}</button></div>
 </form></div>;
}
