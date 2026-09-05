import {describe,expect,it} from "vitest";
import {ledgerReports,LedgerJournal,reportRange,receivableAging,payableAging} from "@/lib/financial-reports";
const range=reportRange("September 2026");
const journal=(id:string,date:string,debit:string,credit:string,value:number):LedgerJournal=>({id,entry_date:date,status:"posted",lines:[{debit:value,credit:0,account:{account_number:debit,name:debit,account_type:debit.startsWith("5")?"expense":"asset"}},{debit:0,credit:value,account:{account_number:credit,name:credit,account_type:credit.startsWith("4")?"income":credit.startsWith("3")?"equity":credit.startsWith("2")?"liability":"asset"}}]});
const fixtures=[journal("capital","2026-07-01","1000","3000",1000),journal("aug-income","2026-08-10","1000","4000",200),journal("income","2026-09-10","1000","4000",300),journal("expense","2026-09-11","5000","1000",50)];
const amount=(id:string,label:string)=>ledgerReports(fixtures,range)[id].rows.find(x=>x.label===label)!.current;
describe("financial report integrity",()=>{
 it("reports only posted income and expenses in the selected period",()=>{
  expect(amount("profit-loss","Total income")).toBe(300);
  expect(amount("profit-loss","Total expenses")).toBe(50);
  expect(amount("profit-loss","Net profit")).toBe(250);
 });
 it("includes unclosed earnings in equity so the balance sheet balances",()=>{
  expect(amount("balance-sheet","Total assets")).toBe(1450);
  expect(amount("balance-sheet","Unclosed earnings")).toBe(450);
  expect(amount("balance-sheet","Liabilities and equity")).toBe(1450);
 });
 it("uses cumulative account balances for trial balance",()=>{
  expect(amount("trial-balance","Closing debit balances")).toBe(1500);
  expect(amount("trial-balance","Closing credit balances")).toBe(1500);
  expect(amount("trial-balance","Difference")).toBe(0);
 });
 it("reconciles opening cash, movement and closing cash",()=>{
  expect(amount("cash-flow","Opening cash · account 1000")).toBe(1200);
  expect(amount("cash-flow","Net cash movement (unclassified)")).toBe(250);
  expect(amount("cash-flow","Closing cash · account 1000")).toBe(1450);
 });
 it("does not invent operational income when the ledger is empty",()=>{
  expect(ledgerReports([],range)["profit-loss"].rows.map(x=>x.current)).toEqual([0,0,0]);
 });
 it("excludes draft and out-of-period entries",()=>{
  const entries=[{...fixtures[2],status:"draft"},journal("future","2026-10-01","1000","4000",900)];
  expect(ledgerReports(entries,range)["profit-loss"].rows.find(x=>x.label==="Total income")?.current).toBe(0);
 });
 it("keeps cents exact for common decimal amounts",()=>{
  const entries=[journal("a","2026-09-01","1000","4000",0.1),journal("b","2026-09-02","1000","4000",0.2)];
  expect(ledgerReports(entries,range)["profit-loss"].rows.find(x=>x.label==="Total income")?.current).toBe(0.3);
 });
 it("rejects non-finite report amounts",()=>{
  expect(()=>ledgerReports([journal("bad","2026-09-01","1000","4000",Infinity)],range)).toThrow("invalid");
 });
 it("compares full past years against a full previous year",()=>{
  expect(reportRange("Year 2025")).toEqual({start:"2025-01-01",end:"2026-01-01",previousStart:"2024-01-01",previousEnd:"2025-01-01"});
 });
 it("clamps leap-day year-to-date comparisons",()=>{
  expect(reportRange("Year to date 2024",new Date("2024-02-29T12:00:00Z"))).toEqual({start:"2024-01-01",end:"2024-03-01",previousStart:"2023-01-01",previousEnd:"2023-03-01"});
 });
 it.each(["Quarter 0, 2026","Quarter 5, 2026","Smarch 2026","bad"])("rejects invalid period %s",period=>expect(()=>reportRange(period)).toThrow());
});

describe("receivable aging",()=>{
 const invoice={issued_on:"2026-08-01",due_on:"2026-09-30",status:"sent",total:100,payments:[] as {received_on:string;amount:number}[],credits:[] as {created_at:string;amount:number}[]};
 it("keeps invoices due on the as-of date current",()=>expect(receivableAging([invoice],"2026-10-01")).toEqual([100,0,0,0]));
 it("deducts only payments received by the as-of date",()=>expect(receivableAging([{...invoice,payments:[{received_on:"2026-09-15",amount:30},{received_on:"2026-10-01",amount:20}]}],"2026-10-01")).toEqual([70,0,0,0]));
 it("reconstructs an invoice paid after the report period",()=>expect(receivableAging([{...invoice,status:"paid",payments:[{received_on:"2026-10-10",amount:100}]}],"2026-10-01")).toEqual([100,0,0,0]));
 it("excludes draft invoices",()=>expect(receivableAging([{...invoice,status:"draft"}],"2026-10-01")).toEqual([0,0,0,0]));
 it("rejects ambiguous historical paid status",()=>expect(()=>receivableAging([{...invoice,status:"paid"}],"2026-10-01")).toThrow("dated payment"));
});

describe("payable aging",()=>{
 const bill={issued_on:"2026-07-01",due_on:"2026-07-31",status:"open",amount:100,payments:[] as {paid_on:string;amount:number}[]};
 it("places unpaid bills into buckets using their due dates",()=>expect(payableAging([bill],"2026-10-01")).toEqual([0,0,0,100]));
 it("deducts only payments made by the report date",()=>expect(payableAging([{...bill,payments:[{paid_on:"2026-09-01",amount:35},{paid_on:"2026-10-01",amount:20}]}],"2026-10-01")).toEqual([0,0,0,65]));
 it("reconstructs bills paid after the report period",()=>expect(payableAging([{...bill,status:"paid",payments:[{paid_on:"2026-10-10",amount:100}]}],"2026-10-01")).toEqual([0,0,0,100]));
 it("excludes draft and void bills",()=>expect(payableAging([{...bill,status:"draft"},{...bill,status:"void"}],"2026-10-01")).toEqual([0,0,0,0]));
 it("rejects a paid status without dated allocations",()=>expect(()=>payableAging([{...bill,status:"paid"}],"2026-10-01")).toThrow("dated payment"));
});
