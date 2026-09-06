export type BankStatementRow={postedOn:string;description:string;amount:number;reference:string;line:number};
export type BankAccount={id:string;name:string;accountType:string;ledgerAccountId:string;ledgerAccount:string};
export type BankMatchCandidate={id:string;bankAccountId:string;date:string;label:string;amount:number};
export type ImportedBankTransaction={id:string;bankAccountId:string;postedOn:string;description:string;amount:number;status:"unreviewed"|"matched"|"excluded";matchedId:string;note:string;reconciliationId:string};
export type BankReconciliation={id:string;bankAccountId:string;startsOn:string;endsOn:string;statementBalance:number;bookBalance:number;status:"draft"|"completed";lockedAt:string};
export type BankImport={id:string;bankAccountId:string;originalName:string;rowCount:number;importedCount:number;duplicateCount:number;createdAt:string};
export type BankingWorkspaceData={accounts:BankAccount[];ledgerAccounts:{id:string;label:string}[];transactions:ImportedBankTransaction[];candidates:BankMatchCandidate[];reconciliations:BankReconciliation[];imports:BankImport[]};

const dateHeaders=["date","posted date","posting date","transaction date"];
const descriptionHeaders=["description","memo","name","details"];
const referenceHeaders=["transaction id","id","reference","check number"];
const headerIndex=(headers:string[],names:string[])=>names.map(name=>headers.indexOf(name)).find(index=>index>=0)??-1;

function csvRows(source:string){
  const rows:string[][]=[];let row:string[]=[],field="",quoted=false;
  for(let i=0;i<source.length;i++){const char=source[i];if(quoted){if(char==='"'&&source[i+1]==='"'){field+='"';i++}else if(char==='"')quoted=false;else field+=char}else if(char==='"'&&!field)quoted=true;else if(char===','){row.push(field);field=""}else if(char==='\n'){row.push(field);rows.push(row);row=[];field=""}else if(char!=='\r')field+=char}
  if(quoted)throw new Error("The CSV contains an unclosed quoted field.");
  if(field||row.length){row.push(field);rows.push(row)}
  return rows.filter(values=>values.some(value=>value.trim()));
}

function parseDate(value:string,line:number){
  const input=value.trim();let normalized=input;
  const us=input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(us)normalized=`${us[3]}-${us[1].padStart(2,"0")}-${us[2].padStart(2,"0")}`;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(normalized))throw new Error(`Line ${line}: use YYYY-MM-DD or MM/DD/YYYY for the date.`);
  const parsed=new Date(`${normalized}T00:00:00Z`);if(Number.isNaN(parsed.valueOf())||parsed.toISOString().slice(0,10)!==normalized)throw new Error(`Line ${line}: the date is invalid.`);
  return normalized;
}

function parseMoney(value:string,line:number,optional=false){
  let input=value.trim();if(!input&&optional)return 0;
  const parentheses=input.startsWith("(")&&input.endsWith(")");if(parentheses)input=input.slice(1,-1);
  input=input.replaceAll(",","").replace(/^\$/,"").trim();
  if(!/^[+-]?\d+(\.\d{1,2})?$/.test(input))throw new Error(`Line ${line}: the amount is invalid.`);
  const amount=Number(input)*(parentheses?-1:1);if(!Number.isFinite(amount))throw new Error(`Line ${line}: the amount is invalid.`);return amount;
}

export function parseBankStatementCsv(source:string):BankStatementRow[]{
  if(!source.trim())throw new Error("The CSV file is empty.");
  const rows=csvRows(source);if(rows.length<2)throw new Error("The CSV needs a header and at least one transaction.");
  const headers=rows[0].map(value=>value.replace(/^\uFEFF/,"").trim().toLowerCase());
  const dateIndex=headerIndex(headers,dateHeaders),descriptionIndex=headerIndex(headers,descriptionHeaders),referenceIndex=headerIndex(headers,referenceHeaders);
  const amountIndex=headers.indexOf("amount"),debitIndex=headers.indexOf("debit"),creditIndex=headers.indexOf("credit");
  if(dateIndex<0||descriptionIndex<0||(amountIndex<0&&(debitIndex<0||creditIndex<0)))throw new Error("Use Date and Description columns, plus Amount or Debit and Credit columns.");
  if(rows.length-1>1000)throw new Error("A statement can contain at most 1,000 transactions.");
  return rows.slice(1).map((values,index)=>{const line=index+2,description=(values[descriptionIndex]??"").trim();if(!description||description.length>200)throw new Error(`Line ${line}: description must be 1 to 200 characters.`);
    let amount:number;if(amountIndex>=0)amount=parseMoney(values[amountIndex]??"",line);else{const debit=parseMoney(values[debitIndex]??"",line,true),credit=parseMoney(values[creditIndex]??"",line,true);if(debit&&credit)throw new Error(`Line ${line}: enter either a debit or a credit.`);amount=credit-Math.abs(debit)}
    amount=Math.round(amount*100)/100;if(!amount)throw new Error(`Line ${line}: amount cannot be zero.`);
    return{postedOn:parseDate(values[dateIndex]??"",line),description,amount,reference:referenceIndex>=0?(values[referenceIndex]??"").trim().slice(0,120):"",line};
  });
}

export function reconciliationDifference(reconciliation:Pick<BankReconciliation,"statementBalance"|"bookBalance">){return Math.round((reconciliation.statementBalance-reconciliation.bookBalance)*100)/100}
