"use server";

import {createClient} from "@/lib/supabase/server";
import {readQueryRows} from "@/lib/read-query-rows";

export type PostingSource = {id:string;kind:"fuel"|"maintenance"|"load";reference:string;date:string;amount:number;posted:string|null};
async function context(companyId:string,write=false) {
  const s=await createClient();
  if(!s)throw new Error("Supabase is not configured.");
  const {data,error}=await s.auth.getClaims();
  const uid=data?.claims?.sub;
  if(error||typeof uid!=="string")throw new Error("Authentication required.");
  const {data:member,error:memberError}=await s.from("company_memberships").select("role").eq("company_id",companyId).eq("user_id",uid).eq("is_active",true).maybeSingle();
  if(memberError||!member||!["owner","administrator","accountant",...(write?[]:["auditor"])].includes(member.role))throw new Error("Accounting access required.");
  return {s,canPost:member.role!=="auditor"};
}
export async function listPostingSources(companyId:string):Promise<{sources:PostingSource[];canPost:boolean}> {
  const {s,canPost}=await context(companyId);
  const [fuel,work,loads,links,invoices]=await Promise.all([
    readQueryRows(offset=>s.from("fuel_entries").select("id,purchased_at,station_name,provider_transaction_id,total_cost").eq("company_id",companyId).in("status",["approved","posted"]).order("id").range(offset,offset+499)),
    readQueryRows(offset=>s.from("work_orders").select("id,issue,completed_at,details").eq("company_id",companyId).eq("status","completed").order("id").range(offset,offset+499)),
    readQueryRows(offset=>s.from("loads").select("id,load_number,customer_rate,fuel_surcharge,fees").eq("company_id",companyId).in("status",["delivered","invoiced","paid"]).order("id").range(offset,offset+499)),
    readQueryRows(offset=>s.from("operational_cost_links").select("id,fuel_entry_id,work_order_id,expense_id,vendor_bill_id").eq("company_id",companyId).order("id").range(offset,offset+499)),
    readQueryRows(offset=>s.from("invoices").select("id,load_id,invoice_number,status").eq("company_id",companyId).not("load_id","is",null).order("id").range(offset,offset+499)),
  ]);
  const linked=new Map<string,string>();
  for(const link of links.data)linked.set(link.fuel_entry_id??link.work_order_id,link.expense_id?"Posted expense":"Posted bill");
  for(const invoice of invoices.data)linked.set(invoice.load_id,`Invoice ${invoice.invoice_number} · ${invoice.status}`);
  const sources:PostingSource[]=[
    ...fuel.data.map(x=>({id:x.id,kind:"fuel" as const,reference:`${x.station_name}${x.provider_transaction_id?` · ${x.provider_transaction_id}`:""}`,date:x.purchased_at.slice(0,10),amount:Number(x.total_cost),posted:linked.get(x.id)??null})),
    ...work.data.map(x=>({id:x.id,kind:"maintenance" as const,reference:`${x.details?.reference??"Work order"} · ${x.issue}`,date:x.completed_at?.slice(0,10)??"",amount:Number(x.details?.actualCost??0),posted:linked.get(x.id)??null})),
    ...loads.data.map(x=>({id:x.id,kind:"load" as const,reference:x.load_number,date:String(x.fees?.delivery_on??""),amount:Number(x.customer_rate)+Number(x.fuel_surcharge),posted:linked.get(x.id)??null})),
  ];
  return {sources:sources.sort((a,b)=>Number(!!a.posted)-Number(!!b.posted)||b.date.localeCompare(a.date)||a.id.localeCompare(b.id)),canPost};
}
export async function postOperationalSource(companyId:string,source:Pick<PostingSource,"id"|"kind">,mode:"expense"|"bill"|"invoice",date:string,due:string,cash:string) {
  const {s}=await context(companyId,true);
  if(source.kind==="load") {
    if(mode!=="invoice")throw new Error("Loads must be posted as invoices.");
    const {data,error}=await s.rpc("issue_load_invoice",{target_company_id:companyId,target_load_id:source.id,issued_date:date,due_date:due});
    if(error)throw new Error(error.message);
    return String(data);
  }
  if(!["fuel","maintenance"].includes(source.kind)||!["expense","bill"].includes(mode))throw new Error("Invalid posting type.");
  const {data,error}=await s.rpc("post_operational_cost",{target_company_id:companyId,source_kind:source.kind,source_id:source.id,posting_kind:mode,posting_date:date,due_date:mode==="bill"?due:null,paid_from_account_id:mode==="expense"?cash:null});
  if(error)throw new Error(error.message);
  return String(data);
}
