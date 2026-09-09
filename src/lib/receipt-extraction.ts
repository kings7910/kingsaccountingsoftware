export type ReceiptSuggestions={vendor?:string;date?:string;totalCost?:number;gallons?:number;tax?:number};
export type ReceiptExtraction={suggestions:ReceiptSuggestions;text:string;warnings:string[]};
export function validReceiptDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parsed=new Date(`${value}T00:00:00Z`);return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
function dollars(value:string){
 const match=value.match(/(?:\$\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})(?!\d)/);
 if(!match||/-\s*\$?\s*$/.test(value.slice(0,match.index)))return undefined;const amount=Number(match[1].replaceAll(",",""));return Number.isFinite(amount)&&amount>=0&&amount<1_000_000?amount:undefined;
}
export function extractReceiptFields(input:string):ReceiptExtraction{
 const text=input.slice(0,30000),lines=text.split(/\r?\n/).map(line=>line.replace(/\s+/g," ").trim()).filter(Boolean);
 const suggestions:ReceiptSuggestions={},warnings:string[]=[];
 const foreignCurrency=/\b(?:CAD|EUR|GBP|MXN|AUD|CANADIAN DOLLARS)\b|[€£]/i.test(text);
 const vendor=lines.slice(0,6).map(line=>line.replace(/^[*#=\s]+|[*#=\s]+$/g,"")).find(line=>
  /[a-z]{2}/i.test(line)&&!/^\d/.test(line)&&!/(?:receipt|welcome|thank you|customer copy|merchant copy|invoice|date|time|www\.|https?:|tel\b|phone|address|\b(?:road|street|avenue|highway|suite)\b)/i.test(line)&&!/^\W+$/.test(line));
 if(vendor)suggestions.vendor=vendor.slice(0,150);
 for(const line of lines){
  const iso=line.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/),us=line.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2}|\d{2})\b/);
  const candidate=iso?`${iso[1]}-${iso[2].padStart(2,"0")}-${iso[3].padStart(2,"0")}`:us?`${us[3].length===2?"20":""}${us[3]}-${us[1].padStart(2,"0")}-${us[2].padStart(2,"0")}`:undefined;
  if(candidate&&validReceiptDate(candidate)){suggestions.date=candidate;break}
 }
 const totals:number[]=[],taxes:number[]=[],volumes:number[]=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(/\b(?:grand total|total sale|sale total|amount due|balance due|total amount|total)\b/i.test(line)&&!/sub\s*total|gallons?|volume|\bgal\b|savings|discount|tax/i.test(line)){
   const amount=dollars(line)??(/^\$?\s*\d[\d,.]*$/.test(lines[i+1]??"")?dollars(lines[i+1]):undefined);if(amount!==undefined&&amount>0)totals.push(amount);
  }
  if(/\b(?:sales tax|tax)\b/i.test(line)&&!/\btotal\b|\brate\b|%/i.test(line)){const amount=dollars(line);if(amount!==undefined)taxes.push(amount)}
  if(!/\b(?:liters?|litres?|price|per|ppg)\b|\/\s*gal/i.test(line)){
   const match=line.match(/\b(?:gallons?|gal)\s*[:=]?\s*(\d+(?:\.\d{1,3})?)\b/i)??line.match(/\b(\d+(?:\.\d{1,3})?)\s*(?:gallons?|gal)\b/i);
   if(match){const value=Number(match[1]);if(value>0&&value<10000)volumes.push(value)}
  }
 }
 function unique(values:number[],field:"totalCost"|"tax"|"gallons"){
  const found=[...new Set(values)];if(found.length===1)suggestions[field]=found[0];else if(found.length>1)warnings.push(`More than one ${field==="totalCost"?"total":field} was found. Enter it manually.`);
 }
 unique(totals,"totalCost");unique(taxes,"tax");unique(volumes,"gallons");
 if(foreignCurrency){delete suggestions.totalCost;delete suggestions.tax;warnings.push("A non-USD currency was detected. Confirm the currency and enter the amount manually.")}
 if(!Object.keys(suggestions).length)warnings.push("No reliable fields found. Try a clearer photo or enter the details manually.");
 return{suggestions,text,warnings};
}
