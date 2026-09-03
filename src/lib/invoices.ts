import { invoiceTotals } from "@/lib/calculations";

export const invoiceStatuses=["Draft","Sent","Overdue","Paid"] as const;
export type InvoiceStatus=(typeof invoiceStatuses)[number];
export type InvoiceItem={id:string;description:string;quantity:number;unitPrice:number;taxRate:number};
export type Invoice={id:string;number:string;customer:string;issuedOn:string;dueOn:string;status:InvoiceStatus;items:InvoiceItem[];notes:string};
export type InvoiceDraft=Omit<Invoice,"id"|"number">;

export const demoInvoices:Invoice[]=[
  {id:"invoice-1048",number:"INV-1048",customer:"BlueLine Logistics",issuedOn:"2026-08-03",dueOn:"2026-09-02",status:"Paid",notes:"",items:[{id:"item-1",description:"Atlanta to Dallas freight",quantity:1,unitPrice:8450,taxRate:0}]},
  {id:"invoice-1049",number:"INV-1049",customer:"Northstar Foods",issuedOn:"2026-08-18",dueOn:"2026-09-17",status:"Sent",notes:"POD attached",items:[{id:"item-2",description:"Savannah to Charlotte freight",quantity:1,unitPrice:4320,taxRate:0}]},
  {id:"invoice-1050",number:"INV-1050",customer:"FreshWay Markets",issuedOn:"2026-07-27",dueOn:"2026-08-26",status:"Overdue",notes:"",items:[{id:"item-3",description:"Memphis to Orlando freight",quantity:1,unitPrice:3760,taxRate:0}]},
];

export function invoiceAmount(invoice:Pick<Invoice,"items">){return invoiceTotals(invoice.items.map(item=>({quantity:item.quantity,unitPrice:item.unitPrice,taxRate:item.taxRate}))).total}
export function nextInvoiceNumber(invoices:Invoice[]){const max=invoices.reduce((value,invoice)=>Math.max(value,Number(invoice.number.replace(/\D/g,""))||0),1000);return `INV-${max+1}`}
export function validateInvoice(draft:InvoiceDraft){const errors:Record<string,string>={};if(!draft.customer.trim())errors.customer="Choose or enter a customer.";if(!draft.issuedOn)errors.issuedOn="Choose an issue date.";if(!draft.dueOn)errors.dueOn="Choose a due date.";if(draft.dueOn&&draft.issuedOn&&draft.dueOn<draft.issuedOn)errors.dueOn="Due date cannot be before the issue date.";if(!draft.items.length||draft.items.some(item=>!item.description.trim()||item.quantity<=0||item.unitPrice<0))errors.items="Every line needs a description, positive quantity, and valid price.";return errors}
