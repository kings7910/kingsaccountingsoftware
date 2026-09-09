"use client";
import {ReceiptScanner} from "@/components/receipts/receipt-scanner";
import {DriverFuelReceipts} from "@/components/fuel/fuel-receipts";
import {FormEvent,useCallback,useEffect,useRef,useState} from "react";
import {Camera,Upload,CheckCircle2,CloudOff,Fuel,MapPin,Navigation,Receipt,Truck} from "lucide-react";
import {DriverFuel,TripDraft,validateDriverFuel,validateTrip} from "@/lib/driver";
import {DriverPortalData,loadDriverPortal,reportDriverIssue,submitDriverFuel,submitDriverTrip,uploadDriverReceipt} from "@/app/actions/driver";
import {DriverQueueEntry,DriverSubmission,driverDraftKey,enqueueDriverSubmission,readDriverDraft,readDriverQueue,removeReviewedSubmission,syncDriverQueue} from "@/lib/driver-queue";
const blankTrip:TripDraft={start:"",end:"",loaded:"",empty:"",note:""};
const fallback:DriverPortalData={driverId:"",name:"Driver",initials:"DR",loadId:"",loadNumber:"—",status:"unassigned",origin:"Origin",destination:"Destination",pickupDetail:"Pickup assigned",deliveryDetail:"Delivery assigned",unit:"—",trailer:"—",vehicle:"Assigned truck",odometer:0,nextService:0,receipts:[]};
export default function DriverPortal(){
const [tab,setTab]=useState("Trip"),[trip,setTrip]=useState<TripDraft>(blankTrip),[fuel,setFuel]=useState<DriverFuel>({gallons:"",cost:"",odometer:"",vendor:""}),[online,setOnline]=useState(true),[message,setMessage]=useState(""),[errors,setErrors]=useState<Record<string,string>>({}),[receipts,setReceipts]=useState<string[]>([]),[portal,setPortal]=useState(fallback);
const [scannedReceipt,setScannedReceipt]=useState<File|null>(null),[pendingFuelPhoto,setPendingFuelPhoto]=useState<File|null>(null),[readingReceipt,setReadingReceipt]=useState(false),[scannerKey,setScannerKey]=useState(0);
const [fuelRefresh,setFuelRefresh]=useState(0);
const cameraInput=useRef<HTMLInputElement>(null),uploadInput=useRef<HTMLInputElement>(null),receiptBusy=useRef(false);
const [uploadingReceipt,setUploadingReceipt]=useState(false),[receiptError,setReceiptError]=useState("");
const [queue,setQueue]=useState<DriverQueueEntry[]>([]),[busy,setBusy]=useState(false),[legacySaved,setLegacySaved]=useState(false);
const submitting=useRef(false);
const [today,setToday]=useState("");
useEffect(()=>{setToday(new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}))},[]);
const synchronize=useCallback(async()=>{
  if(!portal.driverId||!navigator.onLine)return;
  try{
    const result=await syncDriverQueue(localStorage,portal.driverId,{trip:submitDriverTrip,fuel:submitDriverFuel},navigator.locks);
    setQueue(result.entries);
    if(result.sent)setFuelRefresh(x=>x+1);
    if(result.entries.some(x=>x.state==="review"&&!x.retrySafe))setMessage("A submission could not be confirmed. Check with your office before entering it again; its details remain saved below.");
    else if(result.entries.length)setMessage("Saved entries are waiting for a connection. Retrying will not create duplicates.");
    else if(result.sent)setMessage("Saved submissions synchronized.");
  }catch(cause){setMessage(cause instanceof Error?cause.message:"Unable to synchronize saved submissions.")}
},[portal.driverId]);
useEffect(()=>{
  let active=true;
  loadDriverPortal().then(data=>{
    if(!active)return;
    setPortal(data);setReceipts(data.receipts);
    setTrip({...blankTrip,start:String(data.odometer)});
    try{
      if(data.loadId){const draft=readDriverDraft(localStorage,data.driverId,data.loadId);if(draft)setTrip(draft)}
      setQueue(readDriverQueue(localStorage,data.driverId));
      setLegacySaved(["kings-driver-trip","kings-driver-trip-submission","kings-driver-fuel"].some(key=>localStorage.getItem(key)!==null));
    }catch{setMessage("Saved data could not be read. It has been kept on this device.")}
  }).catch(cause=>{if(active)setMessage(cause instanceof Error?cause.message:"Unable to load driver portal.")});
  const sync=()=>setOnline(navigator.onLine);sync();
  window.addEventListener("online",sync);window.addEventListener("offline",sync);
  return()=>{active=false;window.removeEventListener("online",sync);window.removeEventListener("offline",sync)};
},[]);
useEffect(()=>{if(online)void synchronize()},[online,synchronize]);
useEffect(()=>{
  const changed=()=>{try{setQueue(readDriverQueue(localStorage,portal.driverId))}catch{setMessage("Saved submissions could not be read.")}};
  window.addEventListener("storage",changed);return()=>window.removeEventListener("storage",changed);
},[portal.driverId]);
function updateTrip(key:keyof TripDraft,value:string){
  const next={...trip,[key]:value};setTrip(next);
  if(!portal.driverId||!portal.loadId)return;
  try{localStorage.setItem(driverDraftKey(portal.driverId,portal.loadId),JSON.stringify(next));setMessage("Draft saved")}
  catch{setMessage("This device could not save your draft. Keep this page open.")}
}
async function saveSubmission(submission:DriverSubmission){
  if(submitting.current)return;
  submitting.current=true;setBusy(true);
  try{
    enqueueDriverSubmission(localStorage,portal.driverId,portal.loadId,submission);
    setQueue(readDriverQueue(localStorage,portal.driverId));
    // Clear the form only after durable local storage succeeds.
    if(submission.kind==="fuel")setFuel({gallons:"",cost:"",odometer:"",vendor:""});
    else{
      setTrip({...blankTrip,start:submission.data.end});
      localStorage.removeItem(driverDraftKey(portal.driverId,portal.loadId));
    }
    setMessage("Submission saved on this device, waiting to synchronize.");
    if(navigator.onLine)await synchronize();
    return true;
  }catch(cause){setMessage(cause instanceof Error?cause.message:"Unable to save this submission. Keep this page open.");return false}
  finally{submitting.current=false;setBusy(false)}
}
async function removeReviewed(entryId:string){
  if(!confirm("Has your office confirmed whether this entry was recorded? Remove this saved copy only after that check. This does not delete any submitted record."))return;
  try{await removeReviewedSubmission(localStorage,portal.driverId,entryId,navigator.locks);setQueue(readDriverQueue(localStorage,portal.driverId))}
  catch{setMessage("The saved copy could not be removed.")}
}
async function submitTrip(e:FormEvent){e.preventDefault();const found=validateTrip(trip);setErrors(found);if(!Object.keys(found).length)await saveSubmission({kind:"trip",data:trip})}
async function addReceipt(file:File){
if(receiptBusy.current)return;
setReceiptError("");setMessage("");
if(!online){setReceiptError("Connect to upload your receipt. The file has not been saved.");return}
if(!portal.loadId){setReceiptError("An active load is required to submit a receipt.");return}
if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type)){setReceiptError("Use a JPEG, PNG, WebP, or PDF receipt.");return}
if(!file.size||file.size>4*1024*1024){setReceiptError("Choose a non-empty receipt file of 4 MB or smaller.");return}
receiptBusy.current=true;setUploadingReceipt(true);
try{const form=new FormData();form.set("file",file);const label=await uploadDriverReceipt(portal.loadId,form);setReceipts(current=>[label,...current]);setMessage("Receipt uploaded for review.")}
catch(cause){setReceiptError(cause instanceof Error?cause.message:"Unable to upload receipt. Please try again.")}
finally{receiptBusy.current=false;setUploadingReceipt(false)}
}
async function submitFuel(e:FormEvent){e.preventDefault();const found=validateDriverFuel(fuel);setErrors(found);if(!Object.keys(found).length&&!readingReceipt){const saved=await saveSubmission({kind:"fuel",data:fuel});if(saved&&scannedReceipt){setPendingFuelPhoto(scannedReceipt);setScannedReceipt(null);setScannerKey(key=>key+1)}}}async function reportIssue(){const issue=prompt("Describe the vehicle issue");if(!issue)return;if(!online){setMessage("Connect to report a vehicle issue.");return}try{await reportDriverIssue(portal.loadId,issue);setMessage("Vehicle issue reported to fleet management.")}catch(cause){setMessage(cause instanceof Error?cause.message:"Unable to report issue.")}}return <main className="mx-auto min-h-screen max-w-xl bg-[var(--canvas)] pb-28"><header className="bg-[var(--navy)] px-5 pb-7 pt-6 text-white"><div className="flex items-center justify-between"><div><p className="text-xs text-white/55">{today}</p><h1 className="display mt-1 text-2xl font-extrabold">Hello, {portal.name.split(/\s+/)[0]}</h1></div><div className="grid size-10 place-items-center rounded-full bg-[var(--gold)] font-black text-[var(--navy)]">{portal.initials}</div></div>{!online&&<div className="mt-4 flex items-center gap-2 rounded-xl bg-white/10 p-3 text-xs font-semibold"><CloudOff size={16}/>Offline. Saved submissions will stay on this device.</div>}</header>{message&&<div role="status" className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-[var(--teal-light)] p-3 text-xs font-bold text-[var(--teal)]"><CheckCircle2 size={16}/>{message}</div>}<section className="space-y-4 px-4 pt-4">{legacySaved&&<p role="status" className="card p-4 text-sm">This device contains older saved driver data without an account or load reference. It has been preserved and will not be submitted automatically. Ask your office to review it before clearing browser data.</p>}{queue.length>0&&<aside className="card p-4"><h2 className="font-bold">Saved submissions</h2><p className="mt-1 text-xs text-[var(--muted)]">Keep this browser’s saved data until your entries are confirmed.</p>{queue.map(entry=><details className="mt-3 text-sm" key={entry.id}><summary>{entry.submission.kind==="trip"?"Mileage":"Fuel"} · {entry.state==="review"&&!entry.retrySafe?"Needs confirmation":"Waiting to sync"}</summary><p className="mt-2 text-xs">Load: {entry.loadId} · {new Date(entry.createdAt).toLocaleString()}</p><dl>{Object.entries(entry.submission.data).map(([key,value])=><div key={key} className="flex gap-2"><dt>{key}:</dt><dd className="break-all">{value||"—"}</dd></div>)}</dl>{entry.state==="review"&&<button type="button" onClick={()=>void removeReviewed(entry.id)} className="mt-2 rounded-lg border px-3 py-2 text-xs font-bold">Remove saved copy after office review</button>}</details>)}<button type="button" disabled={!online||busy} onClick={()=>void synchronize()} className="mt-3 rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50">Retry saved entries</button></aside>}{tab==="Trip"&&<><article className="card overflow-hidden"><div className="bg-[var(--teal)] p-4 text-white"><div className="flex justify-between"><span className="text-xs font-bold">ACTIVE LOAD · {portal.loadNumber}</span><span className="pill bg-white/15">{portal.status}</span></div><h2 className="display mt-4 text-xl font-extrabold">{portal.origin} → {portal.destination}</h2><p className="mt-1 text-xs text-white/70">Unit {portal.unit} · Trailer {portal.trailer}</p></div><div className="grid grid-cols-[auto_1fr] gap-4 p-4 text-sm"><MapPin className="text-[var(--teal)]"/><div><b>{portal.loadId?"Pickup":"No active load"}</b><p className="text-xs text-[var(--muted)]">{portal.pickupDetail}</p></div><Navigation className="text-[var(--gold)]"/><div><b>Delivery appointment</b><p className="text-xs text-[var(--muted)]">{portal.deliveryDetail}</p></div></div></article><form onSubmit={submitTrip} className="card p-5"><h2 className="display text-xl font-extrabold">Trip mileage</h2><div className="mt-5 grid grid-cols-2 gap-3">{([['start','Starting odometer'],['end','Ending odometer'],['loaded','Loaded miles'],['empty','Empty miles']] as [keyof TripDraft,string][]).map(([key,label])=><label className="text-xs font-bold" key={key}>{label}<input inputMode="decimal" value={trip[key]} onChange={e=>updateTrip(key,e.target.value)} className="input" placeholder="0"/></label>)}</div><label className="mt-4 block text-xs font-bold">Driver note<textarea value={trip.note} onChange={e=>updateTrip("note",e.target.value)} className="input min-h-20"/></label>{Object.values(errors).map(x=><p key={x} className="mt-2 text-xs text-red-600">{x}</p>)}<div className="mt-4 grid grid-cols-2 gap-3"><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--teal)] p-3 text-xs font-bold text-[var(--teal)]"><Camera size={17}/>Odometer photo<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e=>{const file=e.target.files?.[0];if(file)void addReceipt(file);e.target.value=""}}/></label><button disabled={busy||!portal.loadId} className="rounded-xl bg-[var(--teal)] p-3 text-xs font-bold text-white disabled:opacity-50">Submit mileage</button></div></form></>}{tab==="Fuel"&&<><form onSubmit={submitFuel} className="card p-5"><h2 className="display text-xl font-extrabold">Fuel purchase</h2><div className="mt-4"><ReceiptScanner key={scannerKey} initialFile={scannedReceipt} includeDate={false} disabled={busy||!!pendingFuelPhoto} onFile={setScannedReceipt} onBusyChange={setReadingReceipt} fileHelp="After submitting, choose the matching fuel entry below to attach this photo." onApply={({vendor,totalCost,gallons})=>setFuel(current=>({...current,...(vendor!==undefined?{vendor}:{}),...(totalCost!==undefined?{cost:String(totalCost)}:{}),...(gallons!==undefined?{gallons:String(gallons)}:{})}))}/>{pendingFuelPhoto&&<p className="text-xs">Attach or remove your previous scanned photo below before scanning another.</p>}</div><div className="mt-5 grid grid-cols-2 gap-3">{([['vendor','Vendor'],['gallons','Gallons'],['cost','Total cost'],['odometer','Odometer']] as [keyof DriverFuel,string][]).map(([key,label])=><label key={key} className="text-xs font-bold">{label}<input value={fuel[key]} onChange={e=>setFuel(x=>({...x,[key]:e.target.value}))} inputMode={key==="vendor"?undefined:"decimal"} className="input"/></label>)}</div>{Object.values(errors).map(x=><p key={x} className="mt-2 text-xs text-red-600">{x}</p>)}<button disabled={busy||readingReceipt||!portal.loadId} className="mt-5 w-full rounded-xl bg-[var(--teal)] p-3 font-bold text-white disabled:opacity-50">Submit fuel entry</button></form><DriverFuelReceipts loadId={portal.loadId} refresh={fuelRefresh} pendingFile={pendingFuelPhoto} onPendingUploaded={()=>setPendingFuelPhoto(null)} onUploaded={()=>{void loadDriverPortal().then(data=>setReceipts(data.receipts)).catch(()=>setMessage("Receipt saved. Refresh the Receipts tab to see it."))}}/></>}{tab==="Receipts"&&<div className="card p-5"><h2 className="display text-xl font-extrabold">Receipts</h2><p className="mt-2 text-sm text-[var(--muted)]">Take a photo of your receipt or upload an existing image or PDF for review.</p>
<div className="mt-4 grid gap-3 sm:grid-cols-2">
<button type="button" disabled={uploadingReceipt||!online||!portal.loadId} onClick={()=>cameraInput.current?.click()} className="flex items-center justify-center gap-2 rounded-xl bg-[var(--teal)] p-4 font-bold text-white disabled:opacity-50"><Camera size={20}/>Scan with camera</button>
<button type="button" disabled={uploadingReceipt||!online||!portal.loadId} onClick={()=>uploadInput.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-[var(--teal)] p-4 font-bold text-[var(--teal)] disabled:opacity-50"><Upload size={20}/>Upload receipt</button>
<input ref={cameraInput} aria-label="Take receipt photo" type="file" accept="image/*" capture="environment" hidden disabled={uploadingReceipt||!online||!portal.loadId} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void addReceipt(file)}}/>
<input ref={uploadInput} aria-label="Choose receipt file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden disabled={uploadingReceipt||!online||!portal.loadId} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void addReceipt(file)}}/>
</div>
<p className="mt-3 text-xs text-[var(--muted)]">JPEG, PNG, WebP, or PDF · Up to 4 MB per receipt. Camera capture is available on supported phones; other devices may open a file picker.</p>
{!online&&<p role="status" className="mt-3 text-sm">Connect to scan or upload a receipt.</p>}
{!portal.loadId&&<p className="mt-3 text-sm">You need an active load to submit receipts.</p>}
{uploadingReceipt&&<p role="status" className="mt-3 text-sm font-bold">Uploading receipt… Keep this page open.</p>}
{receiptError&&<p role="alert" className="mt-3 text-sm text-red-700">{receiptError}</p>}
<div className="mt-4">{receipts.map(x=><p className="border-t py-3 text-sm" key={x}><Receipt className="mr-2 inline" size={17}/>{x}</p>)}{!receipts.length&&<p className="py-6 text-center text-sm text-[var(--muted)]">No receipts submitted for this load yet.</p>}</div></div>}{tab==="Vehicle"&&<div className="card p-5"><h2 className="display text-xl font-extrabold">Assigned vehicle</h2><div className="mt-4 rounded-2xl bg-[var(--navy)] p-5 text-white"><Truck/><p className="display mt-4 text-2xl font-extrabold">Unit {portal.unit}</p><p className="text-sm text-white/65">{portal.vehicle}</p></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-[var(--muted)]">Odometer</dt><dd className="font-bold">{portal.odometer.toLocaleString()} mi</dd></div><div><dt className="text-xs text-[var(--muted)]">Next service</dt><dd className="font-bold">{Math.max(0,portal.nextService-portal.odometer).toLocaleString()} mi</dd></div></dl><button onClick={reportIssue} className="mt-5 w-full rounded-xl border border-red-200 p-3 font-bold text-red-700">Report vehicle issue</button></div>}</section><nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-xl justify-around border-t border-[var(--line)] bg-white px-2 py-3">{[["Trip",Navigation],["Fuel",Fuel],["Receipts",Receipt],["Vehicle",Truck]].map(([label,Icon])=><button key={String(label)} onClick={()=>{setTab(String(label));setErrors({});setMessage("")}} className={`flex flex-col items-center gap-1 text-[10px] font-bold ${tab===label?"text-[var(--teal)]":"text-[var(--muted)]"}`}><Icon size={20}/>{String(label)}</button>)}</nav></main>}
