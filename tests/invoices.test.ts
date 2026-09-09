import {describe,expect,it} from "vitest";
import {demoInvoices,invoiceAmount,nextInvoiceNumber,validateInvoice} from "@/lib/invoices";

describe("invoice workflows",()=>{
  it("calculates totals from line items",()=>expect(invoiceAmount(demoInvoices[0])).toBe(8450));
  it("generates the next invoice number",()=>expect(nextInvoiceNumber(demoInvoices)).toBe("INV-1051"));
  it("rejects an invalid date range",()=>expect(validateInvoice({customer:"Acme",issuedOn:"2026-09-10",dueOn:"2026-09-01",status:"Draft",notes:"",items:[{id:"1",description:"Freight",quantity:1,unitPrice:100,taxRate:0}]}).dueOn).toBeTruthy());
});

it("validates dated customer allocations and preserves credits",async()=>{
 const {invoiceBalance,validateInvoiceAllocation}=await import("@/lib/invoices");
 const invoice={...demoInvoices[1],issuedOn:"2026-01-01",total:100,payments:[{id:"payment",date:"2026-01-02",amount:100,reference:"",journalNumber:"JE-1"}],credits:[{id:"credit",date:"2026-01-03",amount:25,reason:"Adjustment",journalNumber:"JE-2"}]};
 expect(invoiceBalance(invoice)).toBe(-25);
 const value={date:"2026-01-04",amount:10,accountId:"cash",reference:"Adjustment",requestId:"request"};
 expect(validateInvoiceAllocation(value,invoice,"payment")).toHaveProperty("amount");
 expect(validateInvoiceAllocation(value,invoice,"credit")).toEqual({});
 expect(validateInvoiceAllocation({...value,date:"2025-12-31"},invoice,"credit")).toHaveProperty("date");
 expect(validateInvoiceAllocation({...value,amount:0.001},invoice,"credit")).toHaveProperty("amount");
});
