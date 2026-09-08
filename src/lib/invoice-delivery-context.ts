import "server-only";
import {createClient} from "@/lib/supabase/server";
import type {InvoiceDocument} from "./invoice-document";
export async function invoiceDeliveryContext(companyId:string,mode:"read"|"send"|"settings"="read"){
 const s=await createClient();if(!s)throw new Error("Supabase is not configured.");
 const {data,error}=await s.auth.getClaims();const uid=data?.claims?.sub;
 if(error||typeof uid!=="string")throw new Error("Authentication required.");
 const {data:membership,error:membershipError}=await s.from("company_memberships").select("role").eq("company_id",companyId).eq("user_id",uid).eq("is_active",true).maybeSingle();
 const allowed=mode==="settings"?["owner","administrator"]:mode==="send"?["owner","administrator","accountant"]:["owner","administrator","accountant","auditor"];
 if(membershipError||!membership||!allowed.includes(membership.role))throw new Error(mode==="settings"?"Owner or administrator access required.":"Finance access required.");
 return {s,uid,role:membership.role as string};
}
export async function loadInvoiceDocument(companyId:string,invoiceId:string){
 const {s}=await invoiceDeliveryContext(companyId);
 const {data,error}=await s.rpc("invoice_document",{target_company_id:companyId,target_invoice_id:invoiceId});
 if(error)throw new Error(error.message);return data as InvoiceDocument;
}
