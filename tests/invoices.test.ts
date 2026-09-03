import {describe,expect,it} from "vitest";
import {demoInvoices,invoiceAmount,nextInvoiceNumber,validateInvoice} from "@/lib/invoices";

describe("invoice workflows",()=>{
  it("calculates totals from line items",()=>expect(invoiceAmount(demoInvoices[0])).toBe(8450));
  it("generates the next invoice number",()=>expect(nextInvoiceNumber(demoInvoices)).toBe("INV-1051"));
  it("rejects an invalid date range",()=>expect(validateInvoice({customer:"Acme",issuedOn:"2026-09-10",dueOn:"2026-09-01",status:"Draft",notes:"",items:[{id:"1",description:"Freight",quantity:1,unitPrice:100,taxRate:0}]}).dueOn).toBeTruthy());
});
