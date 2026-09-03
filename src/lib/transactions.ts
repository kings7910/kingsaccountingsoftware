export const transactionStatuses = ["Needs review", "Matched", "Scheduled", "Paid"] as const;
export const transactionKinds = ["income", "expense"] as const;

export type TransactionStatus = (typeof transactionStatuses)[number];
export type TransactionKind = (typeof transactionKinds)[number];

export type Transaction = {
  id: string;
  occurredOn: string;
  payee: string;
  description: string;
  amount: number;
  kind: TransactionKind;
  status: TransactionStatus;
};

export type TransactionDraft = Omit<Transaction, "id">;

export const demoTransactions: Transaction[] = [
  {id:"demo-1",occurredOn:"2026-09-02",payee:"BlueLine Logistics",description:"Invoice #INV-1048",amount:8450,kind:"income",status:"Paid"},
  {id:"demo-2",occurredOn:"2026-09-03",payee:"Pilot Travel Center",description:"Diesel · Unit 204",amount:612.84,kind:"expense",status:"Matched"},
  {id:"demo-3",occurredOn:"2026-09-04",payee:"Martin Fleet Services",description:"Maintenance · Unit 118",amount:1285,kind:"expense",status:"Needs review"},
  {id:"demo-4",occurredOn:"2026-09-05",payee:"Great West Casualty",description:"Insurance",amount:2940,kind:"expense",status:"Scheduled"},
];

export function validateTransaction(draft: TransactionDraft) {
  const errors: Partial<Record<keyof TransactionDraft, string>> = {};
  if (!draft.occurredOn) errors.occurredOn = "Choose a transaction date.";
  if (!draft.payee.trim()) errors.payee = "Enter a payee or customer.";
  if (!draft.description.trim()) errors.description = "Enter a description.";
  if (!Number.isFinite(draft.amount) || draft.amount <= 0) errors.amount = "Amount must be greater than zero.";
  return errors;
}

export function filterTransactions(records: Transaction[], query: string, status: string) {
  const term = query.trim().toLowerCase();
  return records.filter(record =>
    (status === "All statuses" || record.status === status) &&
    (!term || [record.payee, record.description, record.status, record.amount.toFixed(2)].some(value => value.toLowerCase().includes(term)))
  );
}

export function transactionsToCsv(records: Transaction[]) {
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const rows: (string | number)[][] = [["Date", "Payee", "Description", "Type", "Status", "Amount"]];
  records.forEach(record => rows.push([record.occurredOn, record.payee, record.description, record.kind, record.status, record.amount.toFixed(2)]));
  return rows.map(row => row.map(escape).join(",")).join("\n");
}
