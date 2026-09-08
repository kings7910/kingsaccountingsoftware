export const payStatuses=["Draft","Approved","Paid","Reversed"] as const;
export type PayStatus=(typeof payStatuses)[number];
export type Settlement={id:string;journalId?:string;cashAccountId?:string;requestId?:string;driver:string;periodStart:string;periodEnd:string;loads:number;grossPay:number;reimbursements:number;deductions:number;status:PayStatus;paidDate:string};
export type SettlementDraft=Omit<Settlement,"id">;
export const demoSettlements:Settlement[]=[
 {id:"pay-1",driver:"Marcus Hill",periodStart:"2026-09-01",periodEnd:"2026-09-15",loads:8,grossPay:6240,reimbursements:185,deductions:320,status:"Draft",paidDate:""},
 {id:"pay-2",driver:"Dana Brooks",periodStart:"2026-09-01",periodEnd:"2026-09-15",loads:7,grossPay:5780,reimbursements:92,deductions:275,status:"Approved",paidDate:""},
 {id:"pay-3",driver:"Luis Rivera",periodStart:"2026-08-16",periodEnd:"2026-08-31",loads:9,grossPay:6810,reimbursements:210,deductions:355,status:"Paid",paidDate:"2026-09-02"},
];
export function netPay(item:SettlementDraft){return item.grossPay+item.reimbursements-item.deductions}
export function validateSettlement(item:SettlementDraft){const errors:Record<string,string>={};if(!item.driver.trim())errors.driver="Driver is required.";if(!item.periodStart||!item.periodEnd)errors.period="Pay period is required.";else if(item.periodEnd<item.periodStart)errors.period="End date must follow start date.";if(!Number.isInteger(item.loads)||item.loads<0||![item.grossPay,item.reimbursements,item.deductions].every(Number.isFinite)||item.grossPay<0||item.reimbursements<0||item.deductions<0)errors.amount="Loads and amounts must be valid non-negative numbers.";else if(netPay(item)<0)errors.amount="Deductions cannot exceed earnings.";if(item.status==="Paid"&&!item.paidDate)errors.paidDate="Paid date is required.";return errors}
export function nextPayStatus(status:PayStatus):PayStatus|null{return status==="Draft"?"Approved":status==="Approved"?"Paid":null}
export function payrollSummary(items:Settlement[]){return{draft:items.filter(x=>x.status==="Draft").length,approved:items.filter(x=>x.status==="Approved").length,paid:items.filter(x=>x.status==="Paid").reduce((sum,x)=>sum+netPay(x),0),payable:items.filter(x=>x.status!=="Paid"&&x.status!=="Reversed").reduce((sum,x)=>sum+netPay(x),0)}}
