import { describe, expect, it } from "vitest";
import { demoTransactions, filterTransactions, transactionsToCsv, validateTransaction } from "@/lib/transactions";

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
