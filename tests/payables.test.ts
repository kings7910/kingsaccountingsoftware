import {describe,expect,it} from "vitest";
import {billOutstanding,demoVendorBills,filterVendorBills,validateVendorBill,validateVendorBillPayment} from "@/lib/payables";

describe("vendor bills",()=>{
 it("calculates outstanding balances from dated allocations",()=>expect(billOutstanding({...demoVendorBills[0],amount:100,payments:[{id:"p",paidOn:"2026-09-01",amount:35.55,reference:""}]})).toBe(64.45));
 it("validates bill identity, dates and amount",()=>expect(validateVendorBill({vendor:"",billNumber:"",issuedOn:"2026-09-02",dueOn:"2026-09-01",status:"Open",amount:0,description:""})).toMatchObject({vendor:expect.any(String),billNumber:expect.any(String),dueOn:expect.any(String),amount:expect.any(String)}));
 it("prevents overpayment",()=>expect(validateVendorBillPayment({paidOn:"2026-09-05",amount:101,reference:""},100).amount).toContain("exceed"));
 it("filters by vendor, reference and status",()=>expect(filterVendorBills(demoVendorBills,"MFS","Paid").map(x=>x.id)).toEqual(["bill-2"]));
});
