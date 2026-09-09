export const approvalTypes=["Receipt","Fuel entry","Mileage log","Invoice","Work order"] as const;
export type ApprovalStatus="Pending"|"Approved"|"Rejected";
export type ApprovalItem={id:string;type:(typeof approvalTypes)[number];reference:string;submittedBy:string;submittedAt:string;amount:number;description:string;status:ApprovalStatus;reviewedBy:string;reviewedAt:string;note:string;flags:string[]};
export const demoApprovals:ApprovalItem[]=[
 {id:"ap-841",type:"Receipt",reference:"RCT-0841",submittedBy:"Marcus Hill",submittedAt:"2026-09-04T08:40:00Z",amount:612.84,description:"Pilot diesel · Unit 204",status:"Pending",reviewedBy:"",reviewedAt:"",note:"",flags:["Possible duplicate"]},
 {id:"ap-842",type:"Fuel entry",reference:"FUEL-438",submittedBy:"Marcus Hill",submittedAt:"2026-09-04T09:12:00Z",amount:485,description:"Pilot · Dallas, TX",status:"Pending",reviewedBy:"",reviewedAt:"",note:"",flags:[]},
 {id:"ap-843",type:"Mileage log",reference:"MILE-229",submittedBy:"Dana Brooks",submittedAt:"2026-09-03T18:25:00Z",amount:0,description:"Savannah to Charlotte · 252 mi",status:"Pending",reviewedBy:"",reviewedAt:"",note:"",flags:["Odometer mismatch"]},
 {id:"ap-839",type:"Work order",reference:"WO-1050",submittedBy:"Luis Rivera",submittedAt:"2026-09-02T15:11:00Z",amount:1425,description:"Two drive tires · Unit 221",status:"Approved",reviewedBy:"Kendra Williams",reviewedAt:"2026-09-03T10:00:00Z",note:"Matched vendor invoice.",flags:[]},
];
export function decideApproval(item:ApprovalItem,status:"Approved"|"Rejected",reviewer:string,note:string,now=new Date().toISOString()):ApprovalItem{if(item.status!=="Pending")throw new Error("Only pending items can be reviewed.");if(status==="Rejected"&&!note.trim())throw new Error("A rejection note is required.");return{...item,status,reviewedBy:reviewer,reviewedAt:now,note:note.trim()}}
export function approvalSummary(items:ApprovalItem[]){return{pending:items.filter(x=>x.status==="Pending").length,flagged:items.filter(x=>x.status==="Pending"&&x.flags.length>0).length,approved:items.filter(x=>x.status==="Approved").length,rejected:items.filter(x=>x.status==="Rejected").length}}
