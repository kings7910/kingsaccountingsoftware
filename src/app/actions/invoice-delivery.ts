"use server";
import {invoiceDeliveryContext,loadInvoiceDocument} from "@/lib/invoice-delivery-context";
import {createAdminClient} from "@/lib/supabase/admin";
import {encryptEmailCredential,decryptEmailCredential} from "@/lib/email-credentials";
import {documentBalance,invoiceEmailAddress} from "@/lib/invoice-document";
import {renderInvoicePdf} from "@/lib/invoice-pdf";
import {EmailSendError,sendInvoiceWithResend,type InvoiceEmailPayload} from "@/lib/invoice-email-provider";
function admin(){const s=createAdminClient();if(!s)throw new Error("Email backend is not configured.");return s}
export async function loadBusinessEmailSettings(companyId:string){
 await invoiceDeliveryContext(companyId,"settings");
 const {data,error}=await admin().from("company_email_settings").select("sender_email,sender_name,updated_at").eq("company_id",companyId).maybeSingle();if(error)throw new Error("Unable to load email setup.");
 return {configured:!!data,senderEmail:data?.sender_email??"",senderName:data?.sender_name??""};
}
export async function saveBusinessEmailSettings(companyId:string,input:{senderEmail:string;senderName:string;apiKey:string}){
 const {uid}=await invoiceDeliveryContext(companyId,"settings");const s=admin();
 const sender=invoiceEmailAddress(input.senderEmail),name=input.senderName.trim();
 if(!name||name.length>100||/[\r\n<>"\\]/.test(name))throw new Error("Enter a sender name without quotes or angle brackets (up to 100 characters).");
 let encrypted:string;
 if(input.apiKey.trim()){
  if(!/^re_[A-Za-z0-9_\-]{10,200}$/.test(input.apiKey.trim()))throw new Error("Enter a valid Resend API key.");
  encrypted=encryptEmailCredential(input.apiKey.trim(),companyId);
 }else{
  const {data,error}=await s.from("company_email_settings").select("encrypted_api_key").eq("company_id",companyId).maybeSingle();
  if(error||!data)throw new Error("Enter your Resend API key to connect email.");encrypted=data.encrypted_api_key;
 }
 const {error}=await s.from("company_email_settings").upsert({company_id:companyId,sender_email:sender,sender_name:name,encrypted_api_key:encrypted,updated_by:uid,updated_at:new Date().toISOString()});
 if(error)throw new Error("Unable to save email setup.");
}
export async function disconnectBusinessEmail(companyId:string){await invoiceDeliveryContext(companyId,"settings");const {error}=await admin().from("company_email_settings").delete().eq("company_id",companyId);if(error)throw new Error("Unable to disconnect email.")}
export async function loadInvoiceDelivery(companyId:string,invoiceId:string){
 const {s,role}=await invoiceDeliveryContext(companyId);const a=admin();
 const [document,config,history]=await Promise.all([
  loadInvoiceDocument(companyId,invoiceId),
  a.from("company_email_settings").select("sender_email,sender_name").eq("company_id",companyId).maybeSingle(),
  s.from("invoice_email_deliveries").select("id,recipient,sender_email,status,last_error,created_at,accepted_at,first_attempt_at").eq("company_id",companyId).eq("invoice_id",invoiceId).order("created_at",{ascending:false}).limit(50)
 ]);
 if(config.error||history.error)throw new Error("Unable to load invoice delivery details.");
 return {recipient:document.customer.email,number:document.number,canSend:role!=="auditor"&&document.posted&&document.ledgerManaged&&document.status!=="draft",configured:!!config.data,sender:config.data?.sender_email??"",history:history.data??[]};
}
export async function sendInvoiceEmail(companyId:string,invoiceId:string,recipientInput:string,requestId:string){
 const {uid}=await invoiceDeliveryContext(companyId,"send");
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))throw new Error("Invalid delivery reference.");
 const recipient=invoiceEmailAddress(recipientInput),s=admin();
 const existing=await s.from("invoice_email_deliveries").select("id,company_id,invoice_id,recipient,status,first_attempt_at").eq("id",requestId).maybeSingle();
 if(existing.error)throw new Error("Unable to load the email attempt.");
 if(existing.data&&(existing.data.company_id!==companyId||existing.data.invoice_id!==invoiceId||existing.data.recipient!==recipient))throw new Error("Delivery reference was already used with different details.");
 if(existing.data?.status==="accepted")return {accepted:true};
 const config=await s.from("company_email_settings").select("sender_email,sender_name,encrypted_api_key").eq("company_id",companyId).maybeSingle();
 if(config.error||!config.data)throw new Error("Set up invoice email in business Settings first.");
 if(!existing.data){
  const document=await loadInvoiceDocument(companyId,invoiceId);
  if(!document.posted||!document.ledgerManaged||document.status==="draft")throw new Error("Issue and post the invoice before emailing it.");
  const pdf=await renderInvoicePdf(document),subject=`${document.number} from ${document.company.name}`.replace(/[\r\n]/g," ").slice(0,200);
  const payload:InvoiceEmailPayload={from:`${config.data.sender_name} <${config.data.sender_email}>`,to:[recipient],subject,text:`Hello ${document.customer.name},\n\nPlease find ${document.number} from ${document.company.name} attached.\n\nInvoice total: USD ${Number(document.total).toFixed(2)}\nBalance as of this email: USD ${documentBalance(document).toFixed(2)}\nDue date: ${document.dueOn}\n\nPlease contact the sender with any questions.`,attachments:[{filename:`${document.number}.pdf`,content:Buffer.from(pdf).toString("base64")}]};
  const {error}=await s.rpc("prepare_invoice_email",{delivery_id_value:requestId,company_id_value:companyId,invoice_id_value:invoiceId,recipient_value:recipient,sender_value:config.data.sender_email,subject_value:subject,actor_value:uid,payload_value:{message:payload,credential:config.data.encrypted_api_key}});
  if(error)throw new Error(error.message);
 }
 const {data:claimed,error:claimError}=await s.rpc("claim_invoice_email",{delivery_id_value:requestId});
 if(claimError)throw new Error("Unable to reserve this email attempt.");
 if(!claimed){const {data}=await s.from("invoice_email_deliveries").select("status,first_attempt_at").eq("id",requestId).single();if(data?.status==="accepted")return {accepted:true};if(data?.first_attempt_at&&Date.now()-Date.parse(data.first_attempt_at)>23*3600000)throw new Error("This attempt is too old to retry safely. Check the provider history before starting a new email.");throw new Error("This email attempt is being processed. Wait two minutes, then retry the same attempt.")}
 const snapshot=await s.from("invoice_email_payloads").select("payload").eq("delivery_id",requestId).single();
 if(snapshot.error||!snapshot.data)throw new Error("Unable to read the saved message. Retry this attempt in two minutes.");
 const frozen=snapshot.data.payload as {message:InvoiceEmailPayload;credential:string};
 try{
  const providerId=await sendInvoiceWithResend(decryptEmailCredential(frozen.credential,companyId),requestId,frozen.message);
  const {error}=await s.from("invoice_email_deliveries").update({status:"accepted",provider_id:providerId,accepted_at:new Date().toISOString(),lease_until:null,last_error:null}).eq("id",requestId);
  if(error)throw new EmailSendError("The provider accepted the message, but history could not be updated. Retry this same attempt.",true);
  return {accepted:true};
 }catch(cause){
  const uncertain=!(cause instanceof EmailSendError)||cause.uncertain;
  const message=cause instanceof Error?cause.message:"Unable to send email.";
  const {error}=await s.from("invoice_email_deliveries").update({status:uncertain?"unknown":"failed",last_error:message,lease_until:null}).eq("id",requestId).neq("status","accepted");
  if(error)throw new Error(`${message} Retry the same attempt after two minutes.`);throw new Error(message);
 }
}
