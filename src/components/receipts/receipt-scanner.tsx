"use client";
import Image from "next/image";
import {useEffect,useRef,useState} from "react";
import {Camera,Upload} from "lucide-react";
import {recognizeReceipt} from "@/lib/receipt-ocr";
import {validReceiptDate,type ReceiptExtraction,type ReceiptSuggestions} from "@/lib/receipt-extraction";
const blank={vendor:"",date:"",totalCost:"",gallons:""};
export function ReceiptScanner({onApply,onFile,onBusyChange,includeDate=true,disabled=false,fileHelp,initialFile}:{onApply:(values:ReceiptSuggestions)=>void;onFile:(file:File|null)=>void;onBusyChange:(busy:boolean)=>void;includeDate?:boolean;disabled?:boolean;fileHelp:string;initialFile?:File|null}){
 const camera=useRef<HTMLInputElement>(null),upload=useRef<HTMLInputElement>(null),controller=useRef<AbortController|null>(null),generation=useRef(0);
 const [file,setFile]=useState<File|null>(initialFile??null),[preview,setPreview]=useState(""),[result,setResult]=useState<ReceiptExtraction|null>(null),[draft,setDraft]=useState(blank),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{if(!file){setPreview("");return}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file]);
 useEffect(()=>()=>{generation.current++;controller.current?.abort();onBusyChange(false)},[onBusyChange]);
 async function read(next:File){
  if(busy||disabled)return;setError("");setNotice("");
  if(!["image/jpeg","image/png","image/webp"].includes(next.type)||!next.size||next.size>4*1024*1024){setError("Choose a JPEG, PNG, or WebP receipt photo up to 4 MB. PDFs can still be attached after saving.");return}
  setFile(next);onFile(next);setResult(null);setDraft(blank);setBusy(true);onBusyChange(true);setProgress(0);controller.current?.abort();const abort=new AbortController();controller.current=abort;const run=++generation.current;
  try{const found=await recognizeReceipt(next,setProgress,abort.signal);if(run!==generation.current)return;setResult(found);setDraft({vendor:found.suggestions.vendor??"",date:found.suggestions.date??"",totalCost:found.suggestions.totalCost?.toFixed(2)??"",gallons:found.suggestions.gallons?.toString()??""})}
  catch(cause){if(run===generation.current)setError(cause instanceof Error&&cause.name==="AbortError"?"Reading cancelled. You can enter the details manually.":cause instanceof Error?cause.message:"Unable to read this receipt. Try a clearer photo or enter the details manually.")}
  finally{if(run===generation.current){setBusy(false);onBusyChange(false)}}
 }
 function apply(){
  setError("");const values:ReceiptSuggestions={};if(draft.vendor.trim())values.vendor=draft.vendor.trim();
  if(includeDate&&draft.date){if(!validReceiptDate(draft.date)){setError("Check the receipt date.");return}values.date=draft.date}
  for(const key of ["totalCost","gallons"] as const){if(!draft[key].trim())continue;const number=Number(draft[key]);if(!Number.isFinite(number)||number<=0){setError(`Check the ${key==="totalCost"?"total":"gallons"}.`);return}values[key]=number}
  if(!Object.keys(values).length){setError("Enter at least one suggestion to apply, or fill the fuel form manually.");return}
  onApply(values);setNotice("Suggestions applied. Review the fuel form before saving.");
 }
 function remove(){generation.current++;controller.current?.abort();setFile(null);onFile(null);setResult(null);setDraft(blank);setError("");setNotice("");setBusy(false);onBusyChange(false)}
 return <section aria-label="Receipt auto-fill" className="mb-5 rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-4">
  <h3 className="font-extrabold">Auto-fill from a receipt</h3><p className="mt-1 text-xs text-[var(--muted)]">Read a clear English-language receipt photo on this device, then review the suggested fields. USD amounts only.</p>
  <div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" disabled={disabled||busy} onClick={()=>camera.current?.click()} className="flex items-center justify-center gap-2 rounded-xl bg-[var(--teal)] px-3 py-3 text-sm font-bold text-white disabled:opacity-50"><Camera size={17}/>Scan to auto-fill</button><button type="button" disabled={disabled||busy} onClick={()=>upload.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-[var(--teal)] px-3 py-3 text-sm font-bold text-[var(--teal)] disabled:opacity-50"><Upload size={17}/>Upload photo to auto-fill</button></div>
  <input hidden ref={camera} type="file" aria-label="Take receipt photo for auto-fill" accept="image/*" capture="environment" disabled={disabled||busy} onChange={e=>{const next=e.target.files?.[0];e.target.value="";if(next)void read(next)}}/>
  <input hidden ref={upload} type="file" aria-label="Choose receipt photo for auto-fill" accept="image/jpeg,image/png,image/webp" disabled={disabled||busy} onChange={e=>{const next=e.target.files?.[0];e.target.value="";if(next)void read(next)}}/>
  {file&&<div className="mt-3 flex items-center gap-3">{preview&&<Image unoptimized src={preview} width={64} height={80} alt="Selected receipt photo" className="h-20 w-16 rounded border object-contain"/>}<div className="min-w-0 text-xs"><p className="break-all font-bold">{file.name}</p><p className="mt-1 text-[var(--muted)]">{fileHelp}</p>{!disabled&&<button type="button" onClick={remove} className="mt-2 font-bold text-red-700">Remove photo</button>}</div></div>}
  {busy&&<div className="mt-3"><p role="status" className="text-sm">{progress?`Reading receipt… ${progress}%`:"Preparing receipt reader… First use may take a moment."}</p><progress aria-label="Receipt reading progress" className="mt-2 w-full" max={100} value={progress}/><button type="button" onClick={()=>controller.current?.abort()} className="mt-1 text-xs font-bold text-[var(--teal)]">Cancel reading</button></div>}
  {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  {result&&!busy&&<fieldset disabled={disabled} className="mt-4"><legend className="text-sm font-bold">Review suggestions</legend><div className="mt-2 grid gap-3 sm:grid-cols-2">{([['vendor','Suggested vendor','text'],...(includeDate?[['date','Suggested date','date']]:[]),['totalCost','Suggested total (USD)','number'],['gallons','Suggested gallons','number']] as [keyof typeof blank,string,string][]).map(([key,label,type])=><label key={key} className="text-xs font-bold">{label}<input className="input" type={type} step={type==="number"?key==="gallons"?"0.001":"0.01":undefined} value={draft[key]} onChange={e=>setDraft(current=>({...current,[key]:e.target.value}))}/></label>)}</div>{result.suggestions.tax!==undefined&&<p className="mt-2 text-xs">Receipt tax: ${result.suggestions.tax.toFixed(2)}. Check that the total already includes tax.</p>}{result.warnings.map(warning=><p className="mt-2 text-xs" key={warning}>{warning}</p>)}<button type="button" onClick={apply} className="mt-3 rounded-xl bg-[var(--teal)] px-4 py-2 text-sm font-bold text-white">Apply suggestions</button><details className="mt-3 text-xs"><summary className="cursor-pointer font-bold">Read receipt text</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap">{result.text||"No text found."}</pre></details></fieldset>}
  {notice&&<p role="status" className="mt-3 text-sm font-bold text-[var(--teal)]">{notice}</p>}
 </section>;
}
