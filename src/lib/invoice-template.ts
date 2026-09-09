import {z} from "zod";
const text=(max:number)=>z.string().trim().max(max).refine(value=>!/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value),"Remove unsupported control characters.");
export const invoiceTemplateSchema=z.object({
 businessName:text(150),address:text(500),phone:text(60),email:z.union([z.literal(""),z.email().max(254)]),website:text(150),taxId:text(100),
 accentColor:z.string().regex(/^#[0-9a-f]{6}$/i),layout:z.enum(["modern","classic"]),paymentInstructions:text(1500),footer:text(500),
 logoDataUrl:z.string().max(410000).refine(value=>!value||/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value),"Use a PNG or JPEG logo up to 300 KB."),
});
export type InvoiceTemplate=z.infer<typeof invoiceTemplateSchema>;
export const defaultInvoiceTemplate:InvoiceTemplate={businessName:"",address:"",phone:"",email:"",website:"",taxId:"",accentColor:"#147d73",layout:"modern",paymentInstructions:"",footer:"Thank you for your business.",logoDataUrl:""};
export function parseInvoiceTemplate(value:unknown):InvoiceTemplate{
 const result=invoiceTemplateSchema.safeParse(value);if(!result.success)throw new Error(`Check ${result.error.issues[0].path.join(" ")}: ${result.error.issues[0].message}`);return result.data;
}
