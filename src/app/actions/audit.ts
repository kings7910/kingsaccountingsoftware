"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {type AuditEvent, type AuditPage, type AuditCursor} from "@/lib/audit";

const cursorSchema=z.object({id:z.string().uuid(),createdAt:z.string().datetime({offset:true})});
const pageSize=250;

export async function listAuditEvents(companyId:string,cursor?:AuditCursor):Promise<AuditPage>{
  const parsed=cursor===undefined?undefined:cursorSchema.safeParse(cursor);
  if(parsed&&!parsed.success)throw new Error("Invalid audit history cursor. Refresh and try again.");
  const s=await createClient();
  if(!s)throw new Error("Supabase is not configured.");
  const {data:claims,error:authError}=await s.auth.getClaims(),uid=claims?.claims?.sub;
  if(authError||typeof uid!=="string")throw new Error("Authentication required.");
  const {data:membership,error:membershipError}=await s.from("company_memberships").select("role").eq("company_id",companyId).eq("user_id",uid).eq("is_active",true).maybeSingle();
  if(membershipError)throw new Error("Unable to verify audit access. Try again.");
  if(!membership||!["owner","administrator","auditor"].includes(String(membership.role)))throw new Error("Audit access required.");
  let query=s.from("audit_logs").select("id,created_at,action,record_type,record_id,before_data,after_data,ip_address,actor:profiles(full_name)").eq("company_id",companyId).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(pageSize+1);
  if(parsed?.success){
    const {createdAt,id}=parsed.data;
    query=query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`);
  }
  const {data,error}=await query;
  if(error)throw new Error("Unable to load audit history. Try again.");
  const rows=(data??[]).slice(0,pageSize);
  const events:AuditEvent[]=rows.map((x:any)=>{
    const actor=Array.isArray(x.actor)?x.actor[0]:x.actor;
    const before=(x.before_data&&typeof x.before_data==="object"?x.before_data:null) as Record<string,unknown>|null;
    const after=(x.after_data&&typeof x.after_data==="object"?x.after_data:null) as Record<string,unknown>|null;
    const verb=x.action.split(".").at(-1)?.replaceAll("_"," ")??x.action,entity=x.record_type.replaceAll("_"," ");
    return {id:x.id,occurredAt:x.created_at,actor:String(actor?.full_name??"System"),action:x.action,entityType:entity.replace(/\b\w/g,(c:string)=>c.toUpperCase()),entityReference:String(after?.reference??before?.reference??x.record_id??"System"),summary:`${verb.charAt(0).toUpperCase()}${verb.slice(1)} ${entity}`,ipAddress:String(x.ip_address??"Not recorded"),before,after};
  });
  const last=rows.at(-1);
  return {events,nextCursor:(data??[]).length>pageSize&&last?{id:last.id,createdAt:last.created_at}:null};
}
