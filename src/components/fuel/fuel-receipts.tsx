"use client";
import {useEffect,useRef,useState} from "react";
import {Camera,Upload,ExternalLink} from "lucide-react";
import {listDriverFuelTargets,listFuelReceipts,uploadFuelReceipt,type DriverFuelTarget,type FuelReceipt} from "@/app/actions/fuel-receipts";

export function FuelReceipts({entryId,onUploaded,pendingFile,onPendingUploaded}:{entryId:string;onUploaded?:()=>void;pendingFile?:File|null;onPendingUploaded?:()=>void}){
  const [receipts,setReceipts]=useState<FuelReceipt[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
  const camera=useRef<HTMLInputElement>(null),upload=useRef<HTMLInputElement>(null),uploading=useRef(false);
  useEffect(()=>{let active=true;setLoading(true);setError("");listFuelReceipts(entryId).then(rows=>{if(active)setReceipts(rows)}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Unable to load receipts.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[entryId,reload]);
  async function attach(file:File){
    if(uploading.current)return;setError("");setMessage("");
    if(!navigator.onLine){setError("Connect to upload your fuel receipt. The file has not been saved.");return}
    if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type)){setError("Use a JPEG, PNG, WebP, or PDF receipt.");return}
    if(!file.size||file.size>4*1024*1024){setError("Choose a non-empty receipt of 4 MB or smaller.");return}
    uploading.current=true;setBusy(true);
    try{const form=new FormData();form.set("file",file);await uploadFuelReceipt(entryId,form);setMessage("Receipt saved and connected to this fuel entry.");setReload(x=>x+1);onUploaded?.();if(file===pendingFile)onPendingUploaded?.()}
    catch(cause){setError(cause instanceof Error?cause.message:"Unable to upload receipt.")}
    finally{uploading.current=false;setBusy(false)}
  }
  return <section aria-label="Fuel receipt attachments" aria-busy={busy}>
    {pendingFile&&<div className="mb-4 rounded-xl bg-[var(--teal-light)] p-3"><p className="break-all text-sm font-bold">Photo waiting to attach: {pendingFile.name}</p><p className="mt-1 text-xs">The fuel entry is saved. This photo is not attached yet; keep this page open until it finishes.</p><button type="button" disabled={busy} onClick={()=>void attach(pendingFile)} className="mt-2 rounded-lg bg-[var(--teal)] px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Attach scanned photo to this entry</button></div>}
    <p className="text-sm text-[var(--muted)]">Scan or upload your gas or diesel receipt. It will be saved with this fuel entry.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <button type="button" disabled={busy} onClick={()=>camera.current?.click()} className="flex items-center justify-center gap-2 rounded-xl bg-[var(--teal)] p-3 font-bold text-white disabled:opacity-50"><Camera size={18}/>Scan with camera</button>
      <button type="button" disabled={busy} onClick={()=>upload.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-[var(--teal)] p-3 font-bold text-[var(--teal)] disabled:opacity-50"><Upload size={18}/>Upload receipt</button>
    </div>
    <input ref={camera} hidden type="file" aria-label="Take fuel receipt photo" accept="image/*" capture="environment" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void attach(file)}}/>
    <input ref={upload} hidden type="file" aria-label="Choose fuel receipt file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void attach(file)}}/>
    <p className="mt-3 text-xs text-[var(--muted)]">JPEG, PNG, WebP, or PDF · Up to 4 MB. Camera capture requires a supported phone.</p>
    {busy&&<p role="status" className="mt-3 text-sm">Uploading receipt… Keep this panel open.</p>}
    {message&&<p role="status" className="mt-3 text-sm font-bold text-[var(--teal)]">{message}</p>}
    {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {loading?<p role="status" className="mt-3 text-sm">Loading receipts…</p>:<ul className="mt-3 space-y-2">{receipts.map(receipt=><li key={receipt.id}><a href={receipt.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 break-all rounded-xl border border-[var(--line)] p-3 text-sm font-bold text-[var(--teal)]"><ExternalLink size={16} className="shrink-0"/>{receipt.name}</a></li>)}</ul>}
    {!loading&&!error&&!receipts.length&&<p className="mt-3 text-sm text-[var(--muted)]">No receipts attached yet.</p>}
    <button type="button" disabled={busy||loading} onClick={()=>setReload(x=>x+1)} className="mt-3 text-xs font-bold text-[var(--teal)] disabled:opacity-50">Refresh receipts</button>
  </section>;
}

export function DriverFuelReceipts({loadId,refresh,onUploaded,pendingFile,onPendingUploaded}:{loadId:string;refresh:number;onUploaded:()=>void;pendingFile?:File|null;onPendingUploaded?:()=>void}){
  const [entries,setEntries]=useState<DriverFuelTarget[]>([]),[selected,setSelected]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
  useEffect(()=>{if(pendingFile)setSelected("")},[pendingFile]);
  useEffect(()=>{let active=true;if(!loadId){setEntries([]);setLoading(false);return}setLoading(true);setError("");listDriverFuelTargets(loadId).then(rows=>{if(active){setEntries(rows);setSelected(current=>rows.some(row=>row.id===current)?current:pendingFile?"":rows[0]?.id??"")}}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Unable to load fuel entries.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[loadId,refresh,reload,pendingFile]);
  return <article className="card p-5"><h2 className="display text-xl font-extrabold">Fuel receipts</h2>
    {pendingFile&&<div className="mt-3 rounded-xl bg-[var(--teal-light)] p-3 text-sm"><p className="font-bold">Choose the matching fuel entry below to attach your scanned photo.</p><p className="mt-1 text-xs">The photo is kept only while this page is open. If offline, connect and sync first.</p><button type="button" onClick={()=>{if(confirm("Remove this unsaved photo? Your fuel entry will remain saved."))onPendingUploaded?.()}} className="mt-2 text-xs font-bold text-red-700">Remove unsaved photo</button></div>}
    <p className="mt-2 text-sm text-[var(--muted)]">Submit your fuel entry first, then attach its receipt below. Saved offline entries must sync before you can attach a file.</p>
    {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {loading?<p role="status" className="mt-3 text-sm">Loading fuel entries…</p>:entries.length?<><label className="mt-4 block text-xs font-bold">Fuel entry<select className="input" value={selected} onChange={e=>setSelected(e.target.value)}>{pendingFile&&<option value="">Choose matching fuel entry…</option>}{entries.map(entry=><option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>{selected&&<div className="mt-4"><FuelReceipts key={selected} entryId={selected} onUploaded={onUploaded} pendingFile={pendingFile} onPendingUploaded={onPendingUploaded}/></div>}<p className="mt-3 text-xs text-[var(--muted)]">Showing the 50 most recent fuel entries for this load.</p></>:<p className="mt-3 text-sm">No submitted fuel entries for this load yet.</p>}
    <button type="button" disabled={loading} onClick={()=>setReload(x=>x+1)} className="mt-3 text-xs font-bold text-[var(--teal)]">Refresh fuel entries</button>
  </article>;
}
