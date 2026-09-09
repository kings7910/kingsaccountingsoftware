import {loadInvoiceDocument} from "@/lib/invoice-delivery-context";
import {renderInvoicePdf} from "@/lib/invoice-pdf";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{companyId:string;invoiceId:string}>}){
 try{
  const {companyId,invoiceId}=await params;
  const document=await loadInvoiceDocument(companyId,invoiceId),pdf=await renderInvoicePdf(document);
  return new Response(Buffer.from(pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${document.number}.pdf"`,"Cache-Control":"private, no-store"}});
 }catch(cause){const message=cause instanceof Error?cause.message:"Unable to generate invoice PDF.";return Response.json({error:message},{status:message==="Authentication required."?401:message==="Finance access required."?403:message==="Invoice not found"?404:400,headers:{"Cache-Control":"no-store"}})}
}
