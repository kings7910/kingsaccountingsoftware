import {extractReceiptFields,type ReceiptExtraction} from "./receipt-extraction";
import type {Worker} from "tesseract.js";
export async function recognizeReceipt(file:File,onProgress:(value:number)=>void,signal:AbortSignal):Promise<ReceiptExtraction>{
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||!file.size||file.size>4*1024*1024)throw new Error("Choose a JPEG, PNG, or WebP receipt photo up to 4 MB.");
 let worker:Worker|undefined,stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
 let rejectStop!:(error:Error)=>void;
 const interrupted=new Promise<never>((_,reject)=>{rejectStop=reject});
 function stop(error:Error){stopped=true;rejectStop(error);if(worker)void worker.terminate().catch(()=>{})}
 const abort=()=>stop(new DOMException("Receipt reading cancelled.","AbortError"));
 signal.addEventListener("abort",abort,{once:true});
 const work=async()=>{
  if(signal.aborted)throw new DOMException("Receipt reading cancelled.","AbortError");
  const {createWorker,OEM}=await import("tesseract.js");
  if(stopped)throw new DOMException("Receipt reading cancelled.","AbortError");
  const base=new URL("/receipt-ocr/7.0.0/",window.location.origin).href;
  worker=await createWorker("eng",OEM.LSTM_ONLY,{workerPath:`${base}worker.min.js`,corePath:base,langPath:base,gzip:true,errorHandler:()=>stop(new Error("Receipt reader could not finish. Try again or enter the details manually.")),logger:event=>{if(!stopped&&event.status==="recognizing text")onProgress(Math.round(event.progress*100))}});
  if(stopped){await worker.terminate();throw new DOMException("Receipt reading cancelled.","AbortError")}
  const bitmap=await createImageBitmap(file);
  try{
   if(bitmap.width*bitmap.height>40_000_000)throw new Error("This image is too large. Take a smaller receipt photo.");
   const scale=Math.min(1,2200/bitmap.width,6000/bitmap.height),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const context=canvas.getContext("2d");if(!context)throw new Error("Receipt reading is unavailable in this browser.");context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
   const result=await worker.recognize(canvas);return extractReceiptFields(result.data.text);
  }finally{bitmap.close()}
 };
 try{timer=setTimeout(()=>stop(new Error("Reading took too long. Try a clearer, smaller photo or enter the details manually.")),60000);return await Promise.race([work(),interrupted])}
 finally{stopped=true;if(timer)clearTimeout(timer);signal.removeEventListener("abort",abort);if(worker)await worker.terminate().catch(()=>{})}
}
