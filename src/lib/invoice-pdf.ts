import {PDFDocument,rgb,type PDFFont,type PDFPage} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {defaultInvoiceTemplate,parseInvoiceTemplate} from "./invoice-template";
import {billingAddress,documentBalance,type InvoiceDocument} from "./invoice-document";
const money=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"});
const ink=rgb(.05,.18,.23),muted=rgb(.37,.43,.47);
let fontBytes:Promise<Buffer>|undefined;
export async function renderInvoicePdf(invoice:InvoiceDocument):Promise<Uint8Array> {
 if(invoice.items.length>2000)throw new Error("This invoice exceeds the 2,000-line PDF limit.");
 const template=parseInvoiceTemplate({...defaultInvoiceTemplate,...invoice.template});
 const teal=rgb(parseInt(template.accentColor.slice(1,3),16)/255,parseInt(template.accentColor.slice(3,5),16)/255,parseInt(template.accentColor.slice(5,7),16)/255);
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 fontBytes??=readFile(join(process.cwd(),"assets/invoice-fonts/DejaVuSans.ttf"));
 const font=await pdf.embedFont(await fontBytes,{subset:true});
 const allowed=new Set(font.getCharacterSet());
 function clean(value:string){const text=String(value).normalize("NFC").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,"").replace(/\t/g," ");for(const c of text){if(c!=="\n"&&c!=="\r"&&!allowed.has(c.codePointAt(0)!))throw new Error("The invoice contains characters not supported by the PDF font. Contact support to add the required font.")}return text.replace(/\r\n?/g,"\n")}
 let page:PDFPage,y=0;
 function draw(text:string,x:number,at:number,size=10,color=ink){page.drawText(clean(text),{x,y:at,font,size,color})}
 function newPage(){page=pdf.addPage([612,792]);if(template.layout==="modern")page.drawRectangle({x:0,y:780,width:612,height:12,color:teal});y=746;draw(invoice.number,44,y,13,teal);draw(invoice.status==="draft"?"DRAFT — NOT ISSUED":"INVOICE",410,y,12,teal);y-=32}
 function ensure(height:number){if(y-height<60)newPage()}
 function paragraph(text:string,size=10,width=524,color=ink){for(const value of wrapText(clean(text),font,size,width)){ensure(size+6);draw(value,44,y,size,color);y-=size+6}}
 function rule(){ensure(10);page.drawLine({start:{x:44,y},end:{x:568,y},thickness:.5,color:rgb(.8,.85,.85)});y-=14}
 function total(label:string,value:number,strong=false){ensure(22);draw(label,340,y,strong?11:10,strong?ink:muted);const text=money.format(value);draw(text,568-font.widthOfTextAtSize(text,strong?11:10),y,strong?11:10);y-=21}
 newPage();
 if(template.logoDataUrl){
  const logoBytes=Buffer.from(template.logoDataUrl.split(",")[1],"base64");
  if(logoBytes.length>300000)throw new Error("Use a logo up to 300 KB.");
  if(template.logoDataUrl.startsWith("data:image/png")&&logoBytes.length>=24&&(logoBytes.readUInt32BE(16)>4096||logoBytes.readUInt32BE(20)>4096))throw new Error("Logo dimensions must be 4096 pixels or less.");
  let logo;try{logo=template.logoDataUrl.startsWith("data:image/png")?await pdf.embedPng(template.logoDataUrl):await pdf.embedJpg(template.logoDataUrl)}catch{throw new Error("The logo cannot be read. Upload a valid PNG or JPEG image.")}
  if(logo.width>4096||logo.height>4096)throw new Error("Logo dimensions must be 4096 pixels or less.");
  const scale=Math.min(140/logo.width,70/logo.height,1),width=logo.width*scale,height=logo.height*scale;
  page!.drawImage(logo,{x:44,y:y-height,width,height});y-=height+18;
 }
 paragraph(template.businessName||invoice.company.name,18);
 if(!template.businessName&&invoice.company.displayName&&invoice.company.displayName!==invoice.company.name)paragraph(invoice.company.displayName,10,524,muted);
 for(const value of [template.address,template.phone,template.email,template.website,template.taxId?`Tax / registration: ${template.taxId}`:""])if(value)paragraph(value,10,524,muted);
 y-=12;paragraph(`Issued: ${invoice.issuedOn}     Due: ${invoice.dueOn}`,10,524,muted);
 paragraph(`Status: ${invoice.status==="sent"?"Issued":invoice.status}     Amounts in USD`,10,524,muted);
 y-=12;paragraph("BILL TO",10,524,teal);paragraph(invoice.customer.name,13);
 for(const address of billingAddress(invoice.customer.address))paragraph(address);
 if(invoice.customer.email)paragraph(invoice.customer.email,10,524,muted);
 y-=15;rule();
 function headings(){draw("Description",44,y,10,teal);draw("Qty",342,y,10,teal);draw("Unit price",390,y,10,teal);draw("Amount",503,y,10,teal);y-=20}
 headings();
 for(const item of invoice.items){
  const lines=wrapText(clean(item.description),font,10,275);if(y-Math.min(lines.length*15+30,100)<60){newPage();headings()}
  const qty=String(item.quantity),unit=money.format(item.unitPrice),amount=money.format(item.quantity*item.unitPrice);
  draw(qty,373-font.widthOfTextAtSize(qty,9),y,9);draw(unit,466-font.widthOfTextAtSize(unit,9),y,9);draw(amount,568-font.widthOfTextAtSize(amount,9),y,9);
  for(const line of lines){if(y<75){newPage();headings()}draw(line,44,y);y-=15}
  if(item.taxRate){ensure(15);draw(`Tax: ${Number((item.taxRate*100).toFixed(4))}%`,44,y,9,muted);y-=15}
  y-=9;
 }
 ensure(160);rule();total("Subtotal",invoice.subtotal);if(invoice.discount)total("Discount",-invoice.discount);total("Tax",invoice.tax);total("Invoice total",invoice.total,true);
 if(invoice.payments)total("Payments",-invoice.payments);if(invoice.adjustments)total("Reversals / refunds",invoice.adjustments);if(invoice.credits)total("Credit notes",-invoice.credits);
 const balance=documentBalance(invoice);total(balance<0?"Customer credit":"Balance due",Math.abs(balance),true);
 if(invoice.notes){y-=14;paragraph("NOTES",10,524,teal);paragraph(invoice.notes)}
 if(template.paymentInstructions){y-=14;paragraph("PAYMENT INSTRUCTIONS",10,524,teal);paragraph(template.paymentInstructions)}
 if(template.footer){y-=14;paragraph(template.footer,9,524,muted)}
 if(!invoice.ledgerManaged){y-=8;paragraph("Historical invoice. Confirm balances against reconciled accounting records.",9,524,muted)}
 pdf.getPages().forEach((p,i)=>{p.drawText(`${invoice.number}  •  Page ${i+1} of ${pdf.getPageCount()}`,{x:44,y:30,font,size:8,color:muted})});
 pdf.setTitle(`${invoice.number} — ${invoice.customer.name}`);pdf.setAuthor(template.businessName||invoice.company.name);pdf.setCreator("King’s Accounting");
 const bytes=await pdf.save();if(bytes.length>4_000_000)throw new Error("PDF exceeds the 4 MB attachment limit.");return bytes;
}
export function wrapText(text:string,font:Pick<PDFFont,"widthOfTextAtSize">,size:number,width:number){
 const result:string[]=[];
 for(const paragraph of text.split("\n")){
  let line="";
  for(const word of paragraph.split(/\s+/)){
   if(font.widthOfTextAtSize(line?`${line} ${word}`:word,size)<=width){line=line?`${line} ${word}`:word;continue}
   if(line){result.push(line);line=""}
   for(const c of word){if(line&&font.widthOfTextAtSize(line+c,size)>width){result.push(line);line=""}line+=c}
  }
  result.push(line);
 }
 return result;
}
