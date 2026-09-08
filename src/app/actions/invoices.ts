"use server";
import { createClient } from "@/lib/supabase/server";
import { Invoice, InvoiceDraft, InvoiceStatus, InvoiceCursor, InvoicePage, InvoiceAllocationDraft, validateInvoice, validateInvoiceAllocation } from "@/lib/invoices";
const toDb:Record<InvoiceStatus,string>={Draft:"draft",Sent:"sent",Overdue:"overdue",Paid:"paid"};
const fromDb:Record<string,InvoiceStatus>={draft:"Draft",sent:"Sent",overdue:"Overdue",paid:"Paid"};
const selection="id,invoice_number,issued_on,due_on,status,notes,total,ledger_managed,customer:customers(name),journal:journal_entries!invoices_journal_fk(entry_number),items:invoice_items(id,description,quantity,unit_price,tax_rate,sort_order),payments(id,received_on,amount,reference,payment_account_id,journal:journal_entries!payments_journal_fk(entry_number)),adjustments:customer_payment_adjustments(id,adjusted_on,amount,kind,payment_id,reason,journal:journal_entries(entry_number)),credits:credit_notes(id,credited_on,amount,reason,journal:journal_entries!credit_notes_journal_fk(entry_number))";
async function context(companyId:string){
 const s=await createClient();if(!s)throw new Error("Supabase is not configured.");
 const{data,error}=await s.auth.getClaims();const uid=data?.claims?.sub;
 if(error||typeof uid!=="string")throw new Error("Authentication required.");
 const{data:membership,error:membershipError}=await s.from("company_memberships").select("role").eq("company_id",companyId).eq("user_id",uid).eq("is_active",true).maybeSingle();
 if(membershipError||!membership||!["owner","administrator","accountant"].includes(String(membership.role)))throw new Error("Finance access required.");return s;
}
function object(value:unknown):Record<string,unknown>{const row=Array.isArray(value)?value[0]:value;return row&&typeof row==="object"?row as Record<string,unknown>:{}}
function rows(value:unknown):Record<string,unknown>[]{return Array.isArray(value)?value.map(object):[]}
function journal(value:unknown){const n=object(value).entry_number;return n?`JE-${n}`:""}
function mapInvoice(row:Record<string,unknown>):Invoice{return{
 id:String(row.id),number:`INV-${row.invoice_number}`,customer:String(object(row.customer).name??"Customer"),issuedOn:String(row.issued_on),dueOn:String(row.due_on),
 status:fromDb[String(row.status)]??"Draft",notes:String(row.notes??""),total:Number(row.total),ledgerManaged:Boolean(row.ledger_managed),journalNumber:journal(row.journal),
 items:rows(row.items).sort((a,b)=>Number(a.sort_order)-Number(b.sort_order)).map(x=>({id:String(x.id),description:String(x.description),quantity:Number(x.quantity),unitPrice:Number(x.unit_price),taxRate:Number(x.tax_rate)})),
 payments:rows(row.payments).map(x=>({id:String(x.id),date:String(x.received_on),amount:Number(x.amount),reference:String(x.reference??""),accountId:String(x.payment_account_id??""),journalNumber:journal(x.journal)})),
 adjustments:rows(row.adjustments).map(x=>({id:String(x.id),date:String(x.adjusted_on),amount:Number(x.amount),kind:String(x.kind),paymentId:String(x.payment_id??""),reason:String(x.reason),journalNumber:journal(x.journal)})),
 credits:rows(row.credits).map(x=>({id:String(x.id),date:String(x.credited_on),amount:Number(x.amount),reason:String(x.reason),journalNumber:journal(x.journal)})),
}}
export async function listInvoices(companyId:string,cursor?:InvoiceCursor):Promise<InvoicePage>{
 const s=await context(companyId);
 let query=s.from("invoices").select(selection).eq("company_id",companyId).order("issued_on",{ascending:false}).order("id",{ascending:false}).limit(51);
 if(cursor){if(!/^\d{4}-\d{2}-\d{2}$/.test(cursor.issuedOn)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor.id))throw new Error("Invalid invoice page.");query=query.or(`issued_on.lt.${cursor.issuedOn},and(issued_on.eq.${cursor.issuedOn},id.lt.${cursor.id})`)}
 const{data,error}=await query;if(error)throw new Error(error.message);
 const items=(data??[]).slice(0,50).map(mapInvoice),last=items.at(-1);
 return{items,nextCursor:(data??[]).length>50&&last?{id:last.id,issuedOn:last.issuedOn}:null};
}
async function getInvoice(companyId:string,id:string){const s=await context(companyId);const{data,error}=await s.from("invoices").select(selection).eq("company_id",companyId).eq("id",id).single();if(error)throw new Error(error.message);return mapInvoice(data)}
export async function saveInvoice(companyId:string,draft:InvoiceDraft,id?:string,requestId?:string):Promise<Invoice>{
 const errors=validateInvoice(draft);if(Object.keys(errors).length)throw new Error(Object.values(errors)[0]);
 if(draft.status==="Paid")throw new Error("Issue the invoice, then record a dated payment.");
 const s=await context(companyId);const{data,error}=await s.rpc("save_invoice",{target_company_id:companyId,target_invoice_id:id??null,customer_name:draft.customer,issued_date:draft.issuedOn,due_date:draft.dueOn,invoice_status:toDb[draft.status],invoice_notes:draft.notes,line_items:draft.items,request_id_value:requestId??null});
 if(error)throw new Error(error.message);const result=Array.isArray(data)?data[0]:data;if(!result)throw new Error("Invoice was not saved.");return getInvoice(companyId,String(result.id));
}
export async function listInvoicePaymentAccounts(companyId:string){const s=await context(companyId);const{data,error}=await s.from("chart_of_accounts").select("id,account_number,name").eq("company_id",companyId).eq("active",true).eq("account_type","asset").neq("account_number","1100").order("account_number");if(error)throw new Error(error.message);return(data??[]).map(x=>({id:String(x.id),label:`${x.account_number} · ${x.name}`}))}
export async function recordInvoiceAllocation(companyId:string,invoiceId:string,kind:"payment"|"credit",draft:InvoiceAllocationDraft){
 if(kind!=="payment"&&kind!=="credit")throw new Error("Invalid allocation type.");
 if(!/^[0-9a-f-]{36}$/i.test(draft.requestId))throw new Error("Invalid submission reference.");
 const s=await context(companyId);
 // The database owns balance validation and request deduplication. A successful lost-response retry must remain valid after the balance has changed.
 const invoice=await getInvoice(companyId,invoiceId);
 const validation=validateInvoiceAllocation(draft,invoice,kind,false);
 if(Object.keys(validation).length)throw new Error(Object.values(validation)[0]);
 const result=kind==="payment"?await s.rpc("record_invoice_payment",{target_company_id:companyId,target_invoice_id:invoiceId,payment_date:draft.date,payment_amount:draft.amount,payment_account_id_value:draft.accountId,payment_reference:draft.reference,request_id_value:draft.requestId}):await s.rpc("record_invoice_credit",{target_company_id:companyId,target_invoice_id:invoiceId,credit_date:draft.date,credit_amount:draft.amount,credit_reason:draft.reference,request_id_value:draft.requestId});
 if(result.error)throw new Error(result.error.message);return getInvoice(companyId,invoiceId);
}
export async function deleteInvoice(companyId:string,id:string){const s=await context(companyId);const{data,error}=await s.from("invoices").delete().eq("company_id",companyId).eq("id",id).select("id");if(error)throw new Error(error.message);if(!data?.length)throw new Error("Invoice was not deleted.")}

export async function recordInvoiceCorrection(companyId:string,invoiceId:string,kind:"reversal"|"refund",draft:InvoiceAllocationDraft,paymentId?:string):Promise<Invoice>{
 const s=await context(companyId);
 if(!["reversal","refund"].includes(kind)||!draft.reference.trim()||!Number.isFinite(draft.amount)||draft.amount<=0||Math.abs(draft.amount*100-Math.round(draft.amount*100))>0.000001)throw new Error("Enter a reason and a positive amount with at most two decimals.");
 const {error}=await s.rpc("record_customer_payment_adjustment",{target_company_id:companyId,target_invoice_id:invoiceId,payment_id_value:paymentId??null,kind_value:kind,date_value:draft.date,amount_value:draft.amount,reason_value:draft.reference,cash_account_id_value:draft.accountId,request_id_value:draft.requestId});
 if(error)throw new Error(error.message);return getInvoice(companyId,invoiceId);
}

export async function loadInvoiceDefaults(companyId:string):Promise<{paymentTerms:number}>{
 const s=await context(companyId);const {data,error}=await s.from("companies").select("settings").eq("id",companyId).single();if(error)throw new Error(error.message);
 const terms=Number(data.settings?.defaultPaymentTerms??30);return {paymentTerms:Number.isInteger(terms)&&terms>=0&&terms<=365?terms:30};
}
