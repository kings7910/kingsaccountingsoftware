import { invoiceTotals } from "@/lib/calculations";

export const invoiceStatuses=["Draft","Sent","Overdue","Paid"] as const;
export type InvoiceStatus=(typeof invoiceStatuses)[number];
export type InvoiceItem={id:string;description:string;quantity:number;unitPrice:number;taxRate:number};
export type Invoice={id:string;number:string;customer:string;issuedOn:string;dueOn:string;status:InvoiceStatus;items:InvoiceItem[];notes:string;ledgerManaged?:boolean;journalNumber?:string;total?:number;payments?:InvoicePayment[];credits?:InvoiceCredit[];adjustments?:InvoiceAdjustment[]};
export type InvoiceDraft=Pick<Invoice,"customer"|"issuedOn"|"dueOn"|"status"|"items"|"notes">;
export type InvoicePayment={id:string;date:string;amount:number;reference:string;journalNumber:string;accountId?:string};
export type InvoiceAdjustment={id:string;date:string;amount:number;kind:string;paymentId:string;reason:string;journalNumber:string};
export type InvoiceCredit={id:string;date:string;amount:number;reason:string;journalNumber:string};
export type InvoiceAllocationDraft={date:string;amount:number;reference:string;accountId:string;requestId:string};
export type InvoiceCursor={issuedOn:string;id:string};
export type InvoicePage={items:Invoice[];nextCursor:InvoiceCursor|null};
export function invoiceBalance(invoice:Invoice){if(!invoice.payments&&!invoice.credits&&invoice.status==="Paid")return 0;return Math.round(((invoice.total??invoiceAmount(invoice))-(invoice.payments??[]).reduce((n,x)=>n+x.amount,0)-(invoice.credits??[]).reduce((n,x)=>n+x.amount,0)+(invoice.adjustments??[]).reduce((n,x)=>n+x.amount,0))*100)/100}
export function validateInvoiceAllocation(value:InvoiceAllocationDraft,invoice:Invoice,kind:"payment"|"credit",checkBalance=true){
 const errors:Record<string,string>={};const limit=kind==="payment"?invoiceBalance(invoice):(invoice.total??invoiceAmount(invoice))-(invoice.credits??[]).reduce((n,x)=>n+x.amount,0);
 if(!value.date||value.date<invoice.issuedOn||value.date>new Date().toISOString().slice(0,10))errors.date="Choose a date from the invoice date through today.";
 if(!Number.isFinite(value.amount)||value.amount<=0||Math.abs(value.amount*100-Math.round(value.amount*100))>0.000001||(checkBalance&&value.amount>limit))errors.amount="Enter a positive amount within the remaining balance, with at most two decimals.";
 if(kind==="payment"&&!value.accountId)errors.accountId="Choose a cash or bank account.";
 if(kind==="credit"&&!value.reference.trim())errors.reference="Explain the credit.";
 return errors;
}


export const demoInvoices:Invoice[]=[
  {id:"invoice-1048",number:"INV-1048",customer:"BlueLine Logistics",issuedOn:"2026-08-03",dueOn:"2026-09-02",status:"Paid",notes:"",items:[{id:"item-1",description:"Atlanta to Dallas freight",quantity:1,unitPrice:8450,taxRate:0}]},
  {id:"invoice-1049",number:"INV-1049",customer:"Northstar Foods",issuedOn:"2026-08-18",dueOn:"2026-09-17",status:"Sent",notes:"POD attached",items:[{id:"item-2",description:"Savannah to Charlotte freight",quantity:1,unitPrice:4320,taxRate:0}]},
  {id:"invoice-1050",number:"INV-1050",customer:"FreshWay Markets",issuedOn:"2026-07-27",dueOn:"2026-08-26",status:"Overdue",notes:"",items:[{id:"item-3",description:"Memphis to Orlando freight",quantity:1,unitPrice:3760,taxRate:0}]},
];

export function invoiceAmount(invoice:Pick<Invoice,"items">){return invoiceTotals(invoice.items.map(item=>({quantity:item.quantity,unitPrice:item.unitPrice,taxRate:item.taxRate}))).total}
export function nextInvoiceNumber(invoices:Invoice[]){const max=invoices.reduce((value,invoice)=>Math.max(value,Number(invoice.number.replace(/\D/g,""))||0),1000);return `INV-${max+1}`}
export function validateInvoice(draft:InvoiceDraft){const errors:Record<string,string>={};if(!draft.customer.trim())errors.customer="Choose or enter a customer.";if(!draft.issuedOn)errors.issuedOn="Choose an issue date.";if(!draft.dueOn)errors.dueOn="Choose a due date.";if(draft.dueOn&&draft.issuedOn&&draft.dueOn<draft.issuedOn)errors.dueOn="Due date cannot be before the issue date.";if(!draft.items.length||draft.items.some(item=>!item.description.trim()||!Number.isFinite(item.quantity)||item.quantity<=0||!Number.isFinite(item.unitPrice)||item.unitPrice<0||!Number.isFinite(item.taxRate)||item.taxRate<0))errors.items="Every line needs a description, positive quantity, and valid price and tax rate.";return errors}
