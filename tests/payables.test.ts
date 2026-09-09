import {describe,expect,it} from "vitest";
import {billBalance,billOutstanding,billVendorCredit,demoVendorBills,filterVendorBills,validateVendorBill,validateVendorBillAdjustment,validateVendorBillPayment} from "@/lib/payables";

describe("vendor bills",()=>{
 it("calculates outstanding balances from dated allocations",()=>expect(billOutstanding({...demoVendorBills[0],amount:100,payments:[{id:"p",paidOn:"2026-09-01",amount:35.55,reference:"",paymentAccount:"1000 · Cash",journalNumber:"JE-1"}]})).toBe(64.45));
 it("applies debits and credits without losing overpaid vendor credits",()=>{const bill={...demoVendorBills[0],amount:100,payments:[{id:"p",paidOn:"2026-09-01",amount:100,reference:"",paymentAccount:"1000 · Cash",journalNumber:"JE-1"}],adjustments:[{id:"a",adjustedOn:"2026-09-02",type:"Credit" as const,amount:25,reason:"Return",journalNumber:"JE-2"}]};expect(billBalance(bill)).toBe(-25);expect(billOutstanding(bill)).toBe(0);expect(billVendorCredit(bill)).toBe(25)});
 it("validates bill identity, dates, amount and ledger account",()=>expect(validateVendorBill({vendor:"",billNumber:"",issuedOn:"2026-09-02",dueOn:"2026-09-01",status:"Open",amount:0,description:"",expenseAccount:"",paidFromAccount:""})).toMatchObject({vendor:expect.any(String),billNumber:expect.any(String),dueOn:expect.any(String),amount:expect.any(String),expenseAccount:expect.any(String)}));
 it("prevents overpayment",()=>expect(validateVendorBillPayment({paidOn:"2026-09-05",amount:101,reference:"",paymentAccount:"1000 · Cash"},100).amount).toContain("exceed"));
 it("requires a payment account",()=>expect(validateVendorBillPayment({paidOn:"2026-09-05",amount:10,reference:"",paymentAccount:""},100).paymentAccount).toContain("account"));
 it("validates adjustment reasons and credit limits",()=>expect(validateVendorBillAdjustment({adjustedOn:"2026-09-05",type:"Credit",amount:101,reason:""},100)).toMatchObject({amount:expect.stringContaining("exceed"),reason:expect.any(String)}));
 it("rejects adjustments dated before the bill",()=>expect(validateVendorBillAdjustment({adjustedOn:"2026-08-31",type:"Debit",amount:1,reason:"Correction"},100,"2026-09-01").adjustedOn).toContain("precede"));
 it("filters by vendor, reference and status",()=>expect(filterVendorBills(demoVendorBills,"MFS","Paid").map(x=>x.id)).toEqual(["bill-2"]));
});
