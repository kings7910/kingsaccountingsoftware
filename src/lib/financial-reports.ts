import { ReportDefinition, ReportRow } from "./reports";

export type ReportRange = { start: string; end: string; previousStart: string; previousEnd: string };
export function reportRange(period: string, now = new Date()): ReportRange {
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const iso = (year: number, month: number, day = 1) => new Date(Date.UTC(year, month, day)).toISOString().slice(0,10);
  const match = period.match(/^(\w+) (\d{4})$/);
  if (match && months.includes(match[1])) {
    const year = Number(match[2]), month = months.indexOf(match[1]);
    return { start: iso(year,month), end: iso(year,month+1), previousStart: iso(year,month-1), previousEnd: iso(year,month) };
  }
  const quarter = period.match(/^Quarter ([1-4]), (\d{4})$/);
  if (quarter) {
    const year = Number(quarter[2]), month = (Number(quarter[1])-1)*3;
    return { start: iso(year,month), end: iso(year,month+3), previousStart: iso(year,month-3), previousEnd: iso(year,month) };
  }
  const yearMatch = period.match(/^(?:Year to date|Year) (\d{4})$/);
  if (!yearMatch) throw new Error("Choose a valid report period.");
  const year = Number(yearMatch[1]);
  if (period.startsWith("Year to date") && year === now.getUTCFullYear()) {
    // Clamp leap day before adding one day for the exclusive period boundary.
    const month = now.getUTCMonth(), day = now.getUTCDate();
    const previousDay = Math.min(day, new Date(Date.UTC(year-1,month+1,0)).getUTCDate());
    return { start: iso(year,0), end: iso(year,month,day+1), previousStart: iso(year-1,0), previousEnd: iso(year-1,month,previousDay+1) };
  }
  return { start: iso(year,0), end: iso(year+1,0), previousStart: iso(year-1,0), previousEnd: iso(year,0) };
}

type Account = { account_number: string; name: string; account_type: string };
export type LedgerJournal = { id: string; entry_date: string; status: string; lines: { debit: number|string; credit: number|string; account: Account|Account[]|null }[] };
const cents = (value: number|string) => {
  const result = Math.round(Number(value)*100);
  if (!Number.isSafeInteger(result)) throw new Error("Report contains an invalid or excessively large amount.");
  return result;
};
const amountRow = (label: string, current: number, previous: number, emphasis?: ReportRow["emphasis"]): ReportRow => ({label,current:current===0?0:current/100,previous:previous===0?0:previous/100,emphasis});

export function ledgerReports(journals: LedgerJournal[], range: ReportRange): Record<string, Pick<ReportDefinition,"rows">> {
  function balances(start: string, end: string) {
    const accounts = new Map<string, Account & { balance: number }>();
    let cash = 0;
    for (const journal of journals) {
      if(journal.status!=="posted"||journal.entry_date<start||journal.entry_date>=end)continue;
      for(const line of journal.lines) {
        const account = Array.isArray(line.account)?line.account[0]:line.account;
        if(!account)throw new Error("A ledger account is unavailable; the report cannot be completed.");
        const value=cents(line.debit)-cents(line.credit);
        const existing=accounts.get(account.account_number);
        accounts.set(account.account_number,{...account,balance:(existing?.balance??0)+value});
        if(account.account_number==="1000")cash+=value;
      }
    }
    const total=(type:string)=>[...accounts.values()].filter(x=>x.account_type===type).reduce((n,x)=>n+x.balance,0);
    return {accounts,income:-total("income"),expense:total("expense"),asset:total("asset"),liability:-total("liability"),equity:-total("equity"),cash};
  }
  const current=balances(range.start,range.end),previous=balances(range.previousStart,range.previousEnd);
  const closing=balances("0001-01-01",range.end),priorClosing=balances("0001-01-01",range.previousEnd);
  const accountRows=(type:string)=>[...new Set([...current.accounts.keys(),...previous.accounts.keys()])].sort().filter(key=>(current.accounts.get(key)??previous.accounts.get(key))?.account_type===type).map(key=>{
    const account=current.accounts.get(key)??previous.accounts.get(key)!;
    const sign=type==="income"?-1:1;
    return amountRow(`${key} · ${account.name}`,sign*(current.accounts.get(key)?.balance??0),sign*(previous.accounts.get(key)?.balance??0));
  });
  const earnings=closing.income-closing.expense,priorEarnings=priorClosing.income-priorClosing.expense;
  const debit=[...closing.accounts.values()].reduce((n,x)=>n+Math.max(0,x.balance),0),credit=[...closing.accounts.values()].reduce((n,x)=>n+Math.max(0,-x.balance),0);
  const priorDebit=[...priorClosing.accounts.values()].reduce((n,x)=>n+Math.max(0,x.balance),0),priorCredit=[...priorClosing.accounts.values()].reduce((n,x)=>n+Math.max(0,-x.balance),0);
  const allAccounts=[...new Set([...current.accounts.keys(),...previous.accounts.keys()])].sort();
  return {
    "profit-loss":{rows:[...accountRows("income"),amountRow("Total income",current.income,previous.income,"subtotal"),...accountRows("expense"),amountRow("Total expenses",current.expense,previous.expense,"subtotal"),amountRow("Net profit",current.income-current.expense,previous.income-previous.expense,"total")]},
    "balance-sheet":{rows:[amountRow("Total assets",closing.asset,priorClosing.asset,"subtotal"),amountRow("Total liabilities",closing.liability,priorClosing.liability,"subtotal"),amountRow("Posted equity",closing.equity,priorClosing.equity),amountRow("Unclosed earnings",earnings,priorEarnings),amountRow("Total equity",closing.equity+earnings,priorClosing.equity+priorEarnings,"subtotal"),amountRow("Liabilities and equity",closing.liability+closing.equity+earnings,priorClosing.liability+priorClosing.equity+priorEarnings,"total")]},
    "cash-flow":{rows:[amountRow("Opening cash · account 1000",closing.cash-current.cash,priorClosing.cash-previous.cash),amountRow("Net cash movement (unclassified)",current.cash,previous.cash),amountRow("Closing cash · account 1000",closing.cash,priorClosing.cash,"total")]},
    "general-ledger":{rows:allAccounts.map(key=>amountRow(`${key} · ${(current.accounts.get(key)??previous.accounts.get(key))!.name} (debits less credits)`,current.accounts.get(key)?.balance??0,previous.accounts.get(key)?.balance??0))},
    "trial-balance":{rows:[amountRow("Closing debit balances",debit,priorDebit),amountRow("Closing credit balances",credit,priorCredit),amountRow("Difference",debit-credit,priorDebit-priorCredit,"total")]},
    "year-end":{rows:[amountRow("Posted revenue",current.income,previous.income),amountRow("Posted expenses",current.expense,previous.expense),amountRow("Net income",current.income-current.expense,previous.income-previous.expense,"subtotal"),amountRow("Closing assets",closing.asset,priorClosing.asset),amountRow("Closing liabilities",closing.liability,priorClosing.liability),amountRow("Closing equity including earnings",closing.equity+earnings,priorClosing.equity+priorEarnings,"total")]},
  };
}

export type ReceivableInvoice = {
  issued_on:string;due_on:string;status:string;total:number|string;
  payments:{received_on:string;amount:number|string}[];
  credits:{created_at:string;amount:number|string}[];
};
export function receivableAging(invoices:ReceivableInvoice[],exclusiveEnd:string) {
  const buckets=[0,0,0,0];
  for(const invoice of invoices) {
    if(["draft","void","cancelled"].includes(invoice.status)||invoice.issued_on>=exclusiveEnd)continue;
    const total=cents(invoice.total);
    const allAllocated=invoice.payments.reduce((n,p)=>n+cents(p.amount),0)+invoice.credits.reduce((n,p)=>n+cents(p.amount),0);
    if(invoice.status==="paid"&&allAllocated<total)throw new Error("Some invoices were marked paid without dated payment records. Record those payments before generating historical A/R aging.");
    const payments=invoice.payments.filter(p=>p.received_on<exclusiveEnd).reduce((n,p)=>n+cents(p.amount),0);
    const credits=invoice.credits.filter(p=>p.created_at.slice(0,10)<exclusiveEnd).reduce((n,p)=>n+cents(p.amount),0);
    const outstanding=Math.max(0,total-payments-credits);
    const days=Math.floor((Date.parse(exclusiveEnd)-86400000-Date.parse(invoice.due_on))/86400000);
    buckets[days<=0?0:days<=30?1:days<=60?2:3]+=outstanding;
  }
  return buckets.map(value=>value/100);
}
