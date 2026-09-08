"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {readAllPages} from "@/lib/read-all-pages";
import {createClient} from "@/lib/supabase/server";
import {reports,ReportDefinition,ReportRow} from "@/lib/reports";

import {ledgerAccountCreditBalance,ledgerReports,LedgerJournal,reportRange,receivableAging,receivableCredits,ReceivableInvoice,payableAging,payableCredits,PayableBill} from "@/lib/financial-reports";
const inRange=(date:string,start:string,end:string)=>date>=start&&date<end;
const sum=(rows:any[],field:string)=>rows.reduce((total,row)=>total+Number(row[field]??0),0);
const row=(label:string,current:number,previous:number,emphasis?:ReportRow["emphasis"],format?:ReportRow["format"]):ReportRow=>({label,current,previous,emphasis,format});
export async function loadReports(companyId:string,period:string):Promise<ReportDefinition[]>{const s=await createClient();if(!s)throw new Error("Supabase is not configured.");const{data:claims,error:authError}=await s.auth.getClaims(),uid=claims?.claims?.sub;if(authError||typeof uid!=="string")throw new Error("Authentication required.");const{data:membership}=await s.from("company_memberships").select("role").eq("company_id",companyId).eq("user_id",uid).eq("is_active",true).maybeSingle();if(!membership||!["owner","administrator","accountant","auditor"].includes(String(membership.role)))throw new Error("Reporting access required.");const range=reportRange(period),earliest=range.previousStart;
 const read=async(factory:()=>any)=>readAllPages<any>((after,limit)=>{let q=factory().order("id").limit(limit);if(after)q=q.gt("id",after);return q});
 const [lines,invoiceRows,billRows,loads,fuel,mileage,settlements,workOrders,payments,credits,adjustments,billPayments,billAdjustments]=await Promise.all([
  read(()=>s.from("journal_lines").select("id,debit,credit,account:chart_of_accounts(account_number,name,account_type),journal:journal_entries!inner(id,entry_date,status)").eq("company_id",companyId).eq("journal.status","posted").lt("journal.entry_date",range.end)),
  read(()=>s.from("invoices").select("id,issued_on,due_on,status,total").eq("company_id",companyId).lt("issued_on",range.end)),
  read(()=>s.from("vendor_bills").select("id,issued_on,due_on,status,amount").eq("company_id",companyId).lt("issued_on",range.end)),
  read(()=>s.from("loads").select("id,created_at,customer_rate,driver_pay,planned_miles,actual_miles,truck:trucks(unit_number),driver:drivers(profile:profiles(full_name))").eq("company_id",companyId).in("status",["delivered","invoiced","paid"]).gte("created_at",earliest).lt("created_at",range.end)),
  read(()=>s.from("fuel_entries").select("id,purchased_at,gallons,total_cost,truck:trucks(unit_number)").eq("company_id",companyId).in("status",["approved","posted"]).gte("purchased_at",earliest).lt("purchased_at",range.end)),
  read(()=>s.from("mileage_logs").select("id,started_at,total_miles,truck:trucks(unit_number),driver:drivers(profile:profiles(full_name))").eq("company_id",companyId).in("status",["approved","posted"]).gte("started_at",earliest).lt("started_at",range.end)),
  read(()=>s.from("driver_settlements").select("id,created_at,gross_pay,authorized_deductions,reimbursements,status,driver:drivers(profile:profiles(full_name))").eq("company_id",companyId).in("status",["approved","posted"]).gte("created_at",earliest).lt("created_at",range.end)),
  read(()=>s.from("work_orders").select("id,opened_at,status,details,truck:trucks(unit_number)").eq("company_id",companyId).eq("status","completed").gte("opened_at",earliest).lt("opened_at",range.end)),
  read(()=>s.from("payments").select("id,invoice_id,received_on,amount").eq("company_id",companyId)),
  read(()=>s.from("credit_notes").select("id,invoice_id,created_at,credited_on,amount").eq("company_id",companyId)),
  read(()=>s.from("customer_payment_adjustments").select("id,invoice_id,adjusted_on,amount").eq("company_id",companyId)),
  read(()=>s.from("vendor_bill_payments").select("id,vendor_bill_id,paid_on,amount").eq("company_id",companyId)),
  read(()=>s.from("vendor_bill_adjustments").select("id,vendor_bill_id,adjusted_on,adjustment_type,amount").eq("company_id",companyId))
 ]);
 const group=(rows:any[],key:string)=>{const map=new Map<string,any[]>();for(const x of rows){const bucket=map.get(x[key]);if(bucket)bucket.push(x);else map.set(x[key],[x])}return map};
 const ip=group(payments,"invoice_id"),ic=group(credits,"invoice_id"),ia=group(adjustments,"invoice_id"),bp=group(billPayments,"vendor_bill_id"),ba=group(billAdjustments,"vendor_bill_id");
 const invoices=invoiceRows.map(x=>({...x,payments:ip.get(x.id)??[],credits:ic.get(x.id)??[],adjustments:ia.get(x.id)??[]}));
 const bills=billRows.map(x=>({...x,payments:bp.get(x.id)??[],adjustments:ba.get(x.id)??[]}));
 const journals:LedgerJournal[]=lines.map(line=>({...Array.isArray(line.journal)?line.journal[0]:line.journal,lines:[line]}));
 const split=(rows:any[],field:string)=>([rows.filter(x=>inRange(String(x[field]).slice(0,10),range.start,range.end)),rows.filter(x=>inRange(String(x[field]).slice(0,10),range.previousStart,range.previousEnd))] as const),[currentLoads,previousLoads]=split(loads as any[],"created_at"),[currentFuel,previousFuel]=split(fuel as any[],"purchased_at"),[currentMiles,previousMiles]=split(mileage as any[],"started_at"),[currentSettlements,previousSettlements]=split(settlements as any[],"created_at"),[currentWork,previousWork]=split(workOrders as any[],"opened_at");
 const fuelCost=[sum(currentFuel,"total_cost"),sum(previousFuel,"total_cost")],driverPay=[sum(currentSettlements,"gross_pay"),sum(previousSettlements,"gross_pay")],maintenance=[currentWork.reduce((n,x)=>n+Number(x.details?.actualCost??0),0),previousWork.reduce((n,x)=>n+Number(x.details?.actualCost??0),0)],miles=[sum(currentMiles,"total_miles"),sum(previousMiles,"total_miles")],gallons=[sum(currentFuel,"gallons"),sum(previousFuel,"gallons")];
 const by=(rows:any[],name:(x:any)=>string,value:(x:any)=>number)=>{const map=new Map<string,number>();for(const x of rows){const key=name(x)||"Unassigned";map.set(key,(map.get(key)??0)+value(x))}return map},truckCurrent=by(currentLoads,x=>x.truck?.unit_number,x=>Number(x.customer_rate)-Number(x.driver_pay)),truckPrevious=by(previousLoads,x=>x.truck?.unit_number,x=>Number(x.customer_rate)-Number(x.driver_pay)),driverCurrent=by(currentLoads,x=>x.driver?.profile?.full_name,x=>Number(x.customer_rate)-Number(x.driver_pay)),driverPrevious=by(previousLoads,x=>x.driver?.profile?.full_name,x=>Number(x.customer_rate)-Number(x.driver_pay));
 let ar=[0,0,0,0],prevAr=[0,0,0,0],ap=[0,0,0,0],prevAp=[0,0,0,0],vendorCredits=0,previousVendorCredits=0,agingError="",payableError="";
 try{ar=receivableAging(invoices as ReceivableInvoice[],range.end);prevAr=receivableAging(invoices as ReceivableInvoice[],range.previousEnd)}catch(cause){agingError=cause instanceof Error?cause.message:"A/R aging could not be calculated."}
 try{ap=payableAging(bills as PayableBill[],range.end);prevAp=payableAging(bills as PayableBill[],range.previousEnd);vendorCredits=payableCredits(bills as PayableBill[],range.end);previousVendorCredits=payableCredits(bills as PayableBill[],range.previousEnd)}catch(cause){payableError=cause instanceof Error?cause.message:"A/P aging could not be calculated."}
 const payableTotal=ap.reduce((total,value)=>total+value,0)-vendorCredits,previousPayableTotal=prevAp.reduce((total,value)=>total+value,0)-previousVendorCredits,ledgerPayable=ledgerAccountCreditBalance(journals as LedgerJournal[],"2000",range.end),previousLedgerPayable=ledgerAccountCreditBalance(journals as LedgerJournal[],"2000",range.previousEnd);
 const customerCredits=receivableCredits(invoices as ReceivableInvoice[],range.end),priorCustomerCredits=receivableCredits(invoices as ReceivableInvoice[],range.previousEnd);
 const arSubledger=ar.reduce((n,x)=>n+x,0)-customerCredits,priorArSubledger=prevAr.reduce((n,x)=>n+x,0)-priorCustomerCredits;
 const arLedger=-ledgerAccountCreditBalance(journals as LedgerJournal[],"1100",range.end),priorArLedger=-ledgerAccountCreditBalance(journals as LedgerJournal[],"1100",range.previousEnd);
 const dynamic:Record<string,ReportRow[]>={
  "ar-aging":["Current","1–30 days","31–60 days","61+ days"].map((label,i)=>row(label,ar[i],prevAr[i])).concat([row("Total receivables",ar.reduce((n,x)=>n+x,0),prevAr.reduce((n,x)=>n+x,0),"subtotal"),row("Customer credits",-customerCredits,-priorCustomerCredits),row("A/R subledger total",arSubledger,priorArSubledger,"subtotal"),row("Ledger control · account 1100",arLedger,priorArLedger),row("Reconciliation difference",Math.round((arSubledger-arLedger)*100)/100,Math.round((priorArSubledger-priorArLedger)*100)/100,"total")]),
  "ap-aging":["Current","1–30 days","31–60 days","61+ days"].map((label,i)=>row(label,ap[i],prevAp[i])).concat([row("Vendor credits",-vendorCredits,-previousVendorCredits),row("A/P subledger total",payableTotal,previousPayableTotal,"subtotal"),row("Ledger control · account 2000",ledgerPayable,previousLedgerPayable),row("Reconciliation difference",payableTotal-ledgerPayable,previousPayableTotal-previousLedgerPayable,"total")]),
  "profit-truck":[...new Set([...truckCurrent.keys(),...truckPrevious.keys()])].map(x=>row(`Unit ${x}`,truckCurrent.get(x)??0,truckPrevious.get(x)??0)).concat(row("Fleet contribution",sum([...truckCurrent.values()].map(total=>({total})),"total"),sum([...truckPrevious.values()].map(total=>({total})),"total"),"total")),
  "profit-driver":[...new Set([...driverCurrent.keys(),...driverPrevious.keys()])].map(x=>row(x,driverCurrent.get(x)??0,driverPrevious.get(x)??0)).concat(row("Driver contribution",sum([...driverCurrent.values()].map(total=>({total})),"total"),sum([...driverPrevious.values()].map(total=>({total})),"total"),"total")),
  "cost-mile":[row("Fuel per mile",miles[0]?fuelCost[0]/miles[0]:0,miles[1]?fuelCost[1]/miles[1]:0),row("Driver pay per mile",miles[0]?driverPay[0]/miles[0]:0,miles[1]?driverPay[1]/miles[1]:0),row("Maintenance per mile",miles[0]?maintenance[0]/miles[0]:0,miles[1]?maintenance[1]/miles[1]:0),row("Total tracked cost per mile",miles[0]?(fuelCost[0]+driverPay[0]+maintenance[0])/miles[0]:0,miles[1]?(fuelCost[1]+driverPay[1]+maintenance[1])/miles[1]:0,"total")],
  "fuel-summary":[row("Fuel spend",fuelCost[0],fuelCost[1]),row("Gallons purchased",gallons[0],gallons[1],undefined,"number"),row("Average MPG",gallons[0]?miles[0]/gallons[0]:0,gallons[1]?miles[1]/gallons[1]:0,undefined,"number"),row("Cost per gallon",gallons[0]?fuelCost[0]/gallons[0]:0,gallons[1]?fuelCost[1]/gallons[1]:0)],

 };const financial=ledgerReports(journals as LedgerJournal[],range);
 return reports.map(report=>{
  if(report.id==="ar-aging"&&agingError)return{...report,rows:[],unavailableReason:agingError};
  if(report.id==="ap-aging"&&payableError)return{...report,rows:[],unavailableReason:payableError};
  if(report.id==="cost-mile"&&!["owner","administrator"].includes(String(membership.role)))return{...report,rows:[],unavailableReason:"This report requires access to driver settlement totals. Ask an owner or administrator to generate it."};
  if(report.id==="cost-mile"&&(miles[0]===0||miles[1]===0))return{...report,rows:[],unavailableReason:"Approved mileage is required in both periods to compare cost per mile."};
  if(report.id==="profit-truck"||report.id==="profit-driver")return{...report,name:report.id==="profit-truck"?"Load contribution by truck":"Load contribution by driver",description:"Delivered load revenue less assigned driver pay, grouped by load creation date. Excludes fuel, maintenance and overhead.",rows:dynamic[report.id]};
  if(report.id==="cash-flow")return{...report,name:"Cash movement",description:"Posted movement in cash account 1000; activity has not been classified as operating, investing, or financing.",rows:financial[report.id].rows};
  if(report.id==="general-ledger")return{...report,name:"Ledger account activity",description:"Net posted debits less credits by account for the selected period.",rows:financial[report.id].rows};
  return{...report,rows:financial[report.id]?.rows??dynamic[report.id]??[]};
 })}
