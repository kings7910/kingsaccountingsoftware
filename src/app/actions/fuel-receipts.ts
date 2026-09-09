"use server";
import {createClient} from "@/lib/supabase/server";
export type FuelReceipt={id:string;name:string;url:string};
export type DriverFuelTarget={id:string;label:string};
async function session(){
  const s=await createClient();if(!s)throw new Error("Supabase is not configured.");
  const {data,error}=await s.auth.getClaims();const uid=data?.claims?.sub;
  if(error||typeof uid!=="string")throw new Error("Authentication required.");return{s,uid};
}
async function fuelContext(entryId:string){
  const {s,uid}=await session();
  const {data:entry,error}=await s.from("fuel_entries").select("id,company_id,driver_id").eq("id",entryId).maybeSingle();
  if(error||!entry)throw new Error("Fuel entry not found.");
  const {data:member}=await s.from("company_memberships").select("role").eq("company_id",entry.company_id).eq("user_id",uid).eq("is_active",true).maybeSingle();
  if(!member)throw new Error("Fuel access required.");
  if(!["owner","administrator","accountant","fleet_manager"].includes(member.role)){
    const {data:driver}=await s.from("drivers").select("id").eq("id",entry.driver_id??"").eq("profile_id",uid).eq("company_id",entry.company_id).eq("status","active").maybeSingle();
    if(!driver)throw new Error("Fuel access required.");
  }
  return{s,uid,entry};
}
export async function listDriverFuelTargets(loadId:string):Promise<DriverFuelTarget[]>{
  const {s,uid}=await session();const {data:driver,error}=await s.from("drivers").select("id").eq("profile_id",uid).eq("status","active").maybeSingle();
  if(error||!driver)throw new Error("An active driver profile is required.");
  const {data,error:readError}=await s.from("fuel_entries").select("id,station_name,purchased_at,total_cost").eq("driver_id",driver.id).eq("load_id",loadId).order("purchased_at",{ascending:false}).limit(50);
  if(readError)throw new Error(readError.message);
  return(data??[]).map(x=>({id:x.id,label:`${String(x.purchased_at).slice(0,10)} · ${x.station_name} · $${Number(x.total_cost).toFixed(2)}`}));
}
export async function listFuelReceipts(entryId:string):Promise<FuelReceipt[]>{
  const {s,entry}=await fuelContext(entryId);
  const {data,error}=await s.from("receipts").select("id,document:documents!inner(original_name,bucket,object_path)").eq("company_id",entry.company_id).eq("fuel_entry_id",entry.id).order("created_at",{ascending:false});
  if(error)throw new Error(error.message);
  return Promise.all((data??[]).map(async row=>{
    const document=Array.isArray(row.document)?row.document[0]:row.document;
    if(!document)throw new Error("Receipt document not found.");
    const {data:signed,error:signError}=await s.storage.from(document.bucket).createSignedUrl(document.object_path,3600);
    if(signError)throw new Error(signError.message);
    return{id:row.id,name:document.original_name,url:signed.signedUrl};
  }));
}
export async function uploadFuelReceipt(entryId:string,form:FormData){
  const {s,uid,entry}=await fuelContext(entryId);const file=form.get("file");
  if(!(file instanceof File)||!file.size)throw new Error("Choose a receipt image or PDF.");
  if(file.size>4*1024*1024)throw new Error("Receipt files must be 4 MB or smaller.");
  if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type))throw new Error("Use a JPEG, PNG, WebP, or PDF receipt.");
  const path=`${entry.company_id}/${uid}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"-")}`;
  const {error:uploadError}=await s.storage.from("receipts").upload(path,file,{contentType:file.type,upsert:false});
  if(uploadError)throw new Error(uploadError.message);
  const {error}=await s.rpc("record_fuel_receipt",{target_entry_id:entry.id,path_value:path,name_value:file.name,mime_value:file.type,size_value:file.size});
  if(error){await s.storage.from("receipts").remove([path]);throw new Error(error.message)}
}
