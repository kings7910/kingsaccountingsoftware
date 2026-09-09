import { describe, expect, it } from "vitest";
import { demoTransactions, filterTransactions, transactionsToCsv, validateTransaction } from "@/lib/transactions";
import {parseBankStatementCsv,reconciliationDifference} from "@/lib/banking";

describe("transaction workflows", () => {
  it("filters by text and status", () => {
    expect(filterTransactions(demoTransactions, "pilot", "All statuses")).toHaveLength(1);
    expect(filterTransactions(demoTransactions, "", "Needs review")[0].payee).toBe("Martin Fleet Services");
  });

  it("validates required accounting inputs", () => {
    expect(validateTransaction({occurredOn:"",payee:"",description:"",amount:0,kind:"expense",status:"Needs review"})).toEqual({
      occurredOn:"Choose a transaction date.",payee:"Enter a payee or customer.",description:"Enter a description.",amount:"Amount must be greater than zero.",
    });
  });

  it("escapes CSV values", () => {
    const csv=transactionsToCsv([{...demoTransactions[0],payee:'King, "Road" LLC'}]);
    expect(csv).toContain('"King, ""Road"" LLC"');
  });
});

describe("bank statement CSV",()=>{
  it("parses quoted amount rows and normalizes US dates",()=>{
    expect(parseBankStatementCsv('Date,Description,Amount,Reference\n09/05/2026,"Deposit, customer","$1,250.00",ACH-1')).toEqual([{postedOn:"2026-09-05",description:"Deposit, customer",amount:1250,reference:"ACH-1",line:2}]);
  });
  it("maps debit and credit columns to signed movements",()=>{
    const rows=parseBankStatementCsv("Posting Date,Memo,Debit,Credit\n2026-09-05,Fuel,125.40,\n2026-09-06,Deposit,,500");
    expect(rows.map(row=>row.amount)).toEqual([-125.4,500]);
  });
  it("rejects malformed and zero-value rows",()=>{
    expect(()=>parseBankStatementCsv("Date,Description,Amount\n2026-02-30,Invalid,10")).toThrow("date is invalid");
    expect(()=>parseBankStatementCsv("Date,Description,Amount\n2026-09-01,Zero,0")).toThrow("amount cannot be zero");
  });
  it("calculates the signed book difference",()=>expect(reconciliationDifference({statementBalance:950,bookBalance:900})).toBe(50));
});
