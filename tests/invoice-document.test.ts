// @vitest-environment node
import {describe,it,expect,vi,afterEach} from "vitest";
import {PDFDocument} from "pdf-lib";
import {renderInvoicePdf} from "@/lib/invoice-pdf";
import {documentBalance,invoiceEmailAddress,billingAddress,type InvoiceDocument} from "@/lib/invoice-document";
import {encryptEmailCredential,decryptEmailCredential} from "@/lib/email-credentials";
import {sendInvoiceWithResend,type InvoiceEmailPayload} from "@/lib/invoice-email-provider";
const document:InvoiceDocument={id:"invoice",number:"INV-1001",issuedOn:"2026-09-08",dueOn:"2026-10-08",status:"sent",notes:"Thank you — José",subtotal:100,tax:10,discount:0,total:110,ledgerManaged:true,posted:true,company:{name:"King’s Trucking",displayName:"Kings"},customer:{name:"José Transport",email:"billing@example.com",address:null},items:[{description:"Freight delivery",quantity:1,unitPrice:100,taxRate:.1}],payments:50,adjustments:10,credits:20};
const payload:InvoiceEmailPayload={from:"Accounts <accounts@example.com>",to:["billing@example.com"],subject:"Invoice",text:"Attached",attachments:[]};
afterEach(()=>vi.unstubAllEnvs());
describe("invoice documents",()=>{
 it("includes corrections in the remaining balance",()=>expect(documentBalance(document)).toBe(50));
 it("accepts one recipient and rejects header injection and multiple addresses",()=>{expect(invoiceEmailAddress(" BILLING@Example.com ")).toBe("billing@example.com");for(const input of ["a@example.com,b@example.com","a@example.com\r\nBcc: b@example.com","Name <a@example.com>","invalid"])expect(()=>invoiceEmailAddress(input)).toThrow()});
 it("normalizes common billing address fields",()=>expect(billingAddress({street:"1 Main",city:"Boston",state:"MA",zip:"02101",country:"USA"})).toEqual(["1 Main","Boston, MA, 02101","USA"]));
 it("generates a readable PDF with Unicode names and multi-page line items",async()=>{const bytes=await renderInvoicePdf({...document,items:Array.from({length:90},()=>document.items[0])});expect(Buffer.from(bytes).subarray(0,5).toString()).toBe("%PDF-");const parsed=await PDFDocument.load(bytes);expect(parsed.getPageCount()).toBeGreaterThan(2);expect(parsed.getTitle()).toBe("INV-1001 — José Transport")});
 it("fails explicitly for unsupported characters and too many lines",async()=>{await expect(renderInvoicePdf({...document,notes:"🚚"})).rejects.toThrow("characters not supported");await expect(renderInvoicePdf({...document,items:Array.from({length:2001},()=>document.items[0])})).rejects.toThrow("2,000-line")});
});
describe("email credentials",()=>{
 it("encrypts with random IVs and binds ciphertext to the company",()=>{vi.stubEnv("INVOICE_EMAIL_ENCRYPTION_KEY","ab".repeat(32));const first=encryptEmailCredential("re_secret","company-a"),second=encryptEmailCredential("re_secret","company-a");expect(first).not.toBe(second);expect(first).not.toContain("re_secret");expect(decryptEmailCredential(first,"company-a")).toBe("re_secret");expect(()=>decryptEmailCredential(first,"company-b")).toThrow("reconnected")});
 it("requires server encryption configuration",()=>{vi.stubEnv("INVOICE_EMAIL_ENCRYPTION_KEY","");expect(()=>encryptEmailCredential("secret","a")).toThrow("not configured")});
});
describe("email provider",()=>{
 it("keeps the provider idempotency reference stable",async()=>{const fetcher=vi.fn().mockResolvedValue(Response.json({id:"provider-id"}));expect(await sendInvoiceWithResend("key","attempt",payload,fetcher)).toBe("provider-id");expect(fetcher.mock.calls[0][1].headers["Idempotency-Key"]).toBe("invoice/attempt");expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(payload)});
 it.each([408,409,429,500])("treats HTTP %s as uncertain",async status=>{await expect(sendInvoiceWithResend("key","attempt",payload,vi.fn().mockResolvedValue(new Response("",{status})))).rejects.toMatchObject({uncertain:true})});
 it("does not leak provider errors or credentials",async()=>{await expect(sendInvoiceWithResend("secret","attempt",payload,vi.fn().mockResolvedValue(new Response("secret provider detail",{status:403})))).rejects.toMatchObject({uncertain:false,message:"The email provider rejected the credentials or sender domain. Check business email setup."})});
 it("handles lost responses and malformed success responses",async()=>{for(const fetcher of [vi.fn().mockRejectedValue(new Error("network")),vi.fn().mockResolvedValue(Response.json({}))])await expect(sendInvoiceWithResend("key","attempt",payload,fetcher)).rejects.toMatchObject({uncertain:true})});
});

describe("editable invoice templates",()=>{
 it("applies the business identity and both layouts to PDFs",async()=>{
  const {defaultInvoiceTemplate}=await import("@/lib/invoice-template");
  for(const layout of ["modern","classic"] as const){const pdf=await PDFDocument.load(await renderInvoicePdf({...document,template:{...defaultInvoiceTemplate,businessName:"Custom Transport LLC",address:"12 Main Street\nAtlanta GA 30301",phone:"404-555-0100",email:"contact@example.com",paymentInstructions:"Please pay within 30 days.",layout,accentColor:"#663399"}}));expect(pdf.getAuthor()).toBe("Custom Transport LLC");expect(pdf.getPageCount()).toBeGreaterThan(0)}
 });
 it("rejects broken logos before generating an unusable document",async()=>{
  const {defaultInvoiceTemplate}=await import("@/lib/invoice-template");
  await expect(renderInvoicePdf({...document,template:{...defaultInvoiceTemplate,logoDataUrl:"data:image/png;base64,YmFk"}})).rejects.toThrow("logo cannot be read");
 });
 it("validates logo types, bounded fields and colors",async()=>{
  const {defaultInvoiceTemplate,parseInvoiceTemplate}=await import("@/lib/invoice-template");
  for(const patch of [{logoDataUrl:"https://example.com/logo.png"},{logoDataUrl:"data:image/svg+xml;base64,PHN2Zz4="},{accentColor:"red"},{phone:"x".repeat(61)},{email:"not-email"}])expect(()=>parseInvoiceTemplate({...defaultInvoiceTemplate,...patch})).toThrow();
 });
});
