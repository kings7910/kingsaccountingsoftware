"use server";
import {invoiceDeliveryContext} from "@/lib/invoice-delivery-context";
import {defaultInvoiceTemplate,parseInvoiceTemplate,type InvoiceTemplate} from "@/lib/invoice-template";
import {renderInvoicePdf} from "@/lib/invoice-pdf";
import type {InvoiceDocument} from "@/lib/invoice-document";
function sample(template:InvoiceTemplate):InvoiceDocument{return {id:"preview",number:"INV-PREVIEW",issuedOn:new Date().toISOString().slice(0,10),dueOn:new Date(Date.now()+30*86400000).toISOString().slice(0,10),status:"draft",notes:"Sample invoice — preview only",subtotal:1250,tax:0,discount:0,total:1250,ledgerManaged:true,posted:false,company:{name:template.businessName||"Your business",displayName:""},customer:{name:"Sample customer",email:"billing@example.com",address:{line1:"123 Customer Street",city:"Atlanta",state:"GA",zip:"30301"}},items:[{description:"Freight transportation services",quantity:1,unitPrice:1250,taxRate:0}],payments:0,adjustments:0,credits:0,template}}
export async function loadInvoiceTemplate(companyId:string){
 const {s,role}=await invoiceDeliveryContext(companyId);
 const [template,company]=await Promise.all([s.from("invoice_templates").select("settings").eq("company_id",companyId).maybeSingle(),s.from("companies").select("legal_name").eq("id",companyId).single()]);
 if(template.error||company.error)throw new Error("Unable to load invoice template. Please retry.");
 return {template:parseInvoiceTemplate({...defaultInvoiceTemplate,businessName:company.data.legal_name,...template.data?.settings}),canEdit:role!=="auditor"};
}
export async function saveInvoiceTemplate(companyId:string,input:InvoiceTemplate){
 const {s}=await invoiceDeliveryContext(companyId,"send"),template=parseInvoiceTemplate(input);
 // Render before saving to validate the image and font against the actual PDF engine.
 await renderInvoicePdf(sample(template));
 const {error}=await s.from("invoice_templates").upsert({company_id:companyId,settings:template,updated_at:new Date().toISOString()});
 if(error)throw new Error("Unable to save invoice template. Please retry.");return template;
}
export async function previewInvoiceTemplate(companyId:string,input:InvoiceTemplate){
 await invoiceDeliveryContext(companyId);return Buffer.from(await renderInvoicePdf(sample(parseInvoiceTemplate(input)))).toString("base64");
}
