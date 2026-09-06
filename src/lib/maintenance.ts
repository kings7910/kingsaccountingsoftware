export const workOrderStatuses=["Scheduled","In progress","Completed","Cancelled"] as const;
export const serviceTypes=["Preventive maintenance","Inspection","Repair","Tires","Other"] as const;
export type WorkOrderStatus=(typeof workOrderStatuses)[number];
export type WorkOrder={id:string;reference:string;unit:string;serviceType:(typeof serviceTypes)[number];description:string;vendor:string;scheduledDate:string;odometer:number;estimatedCost:number;actualCost:number;status:WorkOrderStatus;completedDate:string};
export type WorkOrderDraft=Omit<WorkOrder,"id">;

export const demoWorkOrders:WorkOrder[]=[
  {id:"wo-1052",reference:"WO-1052",unit:"118",serviceType:"Preventive maintenance",description:"Oil and filter service",vendor:"Martin Fleet Services",scheduledDate:"2026-09-06",odometer:193000,estimatedCost:485,actualCost:0,status:"Scheduled",completedDate:""},
  {id:"wo-1051",reference:"WO-1051",unit:"204",serviceType:"Inspection",description:"Annual DOT inspection",vendor:"Peach State Truck Center",scheduledDate:"2026-09-03",odometer:168240,estimatedCost:275,actualCost:310,status:"In progress",completedDate:""},
  {id:"wo-1050",reference:"WO-1050",unit:"221",serviceType:"Tires",description:"Replace two drive tires",vendor:"Southern Tire",scheduledDate:"2026-08-29",odometer:121180,estimatedCost:1380,actualCost:1425,status:"Completed",completedDate:"2026-08-29"},
];

export function validateWorkOrder(draft:WorkOrderDraft,records:WorkOrder[],editingId?:string){
  const errors:Record<string,string>={};
  if(!draft.reference.trim()) errors.reference="Reference is required.";
  if(records.some(item=>item.id!==editingId&&item.reference.toLowerCase()===draft.reference.trim().toLowerCase())) errors.reference="This reference already exists.";
  if(!draft.unit.trim()) errors.unit="Unit is required.";
  if(!draft.description.trim()) errors.description="Description is required.";
  if(!draft.scheduledDate) errors.scheduledDate="Scheduled date is required.";
  if(!Number.isFinite(draft.odometer)||draft.odometer<0) errors.odometer="Odometer cannot be negative.";
  if(!Number.isFinite(draft.estimatedCost)||!Number.isFinite(draft.actualCost)||draft.estimatedCost<0||draft.actualCost<0) errors.cost="Costs cannot be negative.";
  if(draft.status==="Completed"&&!draft.completedDate) errors.completedDate="Completion date is required.";
  return errors;
}

export function nextWorkOrderStatus(status:WorkOrderStatus):WorkOrderStatus|null{
  if(status==="Scheduled") return "In progress";
  if(status==="In progress") return "Completed";
  return null;
}

export function maintenanceSummary(records:WorkOrder[]){
  return {
    open:records.filter(item=>item.status==="Scheduled"||item.status==="In progress").length,
    inProgress:records.filter(item=>item.status==="In progress").length,
    completed:records.filter(item=>item.status==="Completed").length,
    actualCost:records.filter(item=>item.status==="Completed").reduce((sum,item)=>sum+item.actualCost,0),
  };
}
