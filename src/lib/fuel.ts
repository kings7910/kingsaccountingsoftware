export type FuelEntry={id:string;date:string;unit:string;vendor:string;location:string;gallons:number;totalCost:number;odometer:number;state:string;receiptReference:string};
export type FuelDraft=Omit<FuelEntry,"id">;
export const demoFuelEntries:FuelEntry[]=[
 {id:"fuel-1",date:"2026-09-03",unit:"204",vendor:"Pilot",location:"Dallas, TX",gallons:116.4,totalCost:485,odometer:168240,state:"TX",receiptReference:"RCT-0844"},
 {id:"fuel-2",date:"2026-09-01",unit:"204",vendor:"Love’s",location:"Memphis, TN",gallons:124.4,totalCost:533,odometer:167398,state:"TN",receiptReference:"RCT-0839"},
 {id:"fuel-3",date:"2026-08-31",unit:"118",vendor:"TA",location:"Macon, GA",gallons:132.4,totalCost:581,odometer:192580,state:"GA",receiptReference:"RCT-0834"},
 {id:"fuel-4",date:"2026-08-29",unit:"221",vendor:"Shell",location:"Tampa, FL",gallons:140.4,totalCost:629,odometer:121400,state:"FL",receiptReference:"RCT-0828"},
];
export function validateFuelEntry(draft:FuelDraft){const errors:Record<string,string>={};if(!draft.date)errors.date="Date is required.";if(!draft.unit.trim())errors.unit="Unit is required.";if(!draft.vendor.trim())errors.vendor="Vendor is required.";if(!Number.isFinite(draft.gallons)||draft.gallons<=0)errors.gallons="Gallons must be greater than zero.";if(!Number.isFinite(draft.totalCost)||draft.totalCost<=0)errors.totalCost="Cost must be greater than zero.";if(!Number.isFinite(draft.odometer)||draft.odometer<0)errors.odometer="Odometer cannot be negative.";return errors}
export function fuelSummary(entries:FuelEntry[]){const gallons=entries.reduce((sum,x)=>sum+x.gallons,0),cost=entries.reduce((sum,x)=>sum+x.totalCost,0);return{gallons,cost,averagePrice:gallons?cost/gallons:0}}
export function unitEfficiency(entries:FuelEntry[],unit:string){const rows=entries.filter(x=>x.unit===unit&&x.odometer>0).sort((a,b)=>a.odometer-b.odometer);if(rows.length<2)return null;const miles=rows.at(-1)!.odometer-rows[0].odometer;const gallons=rows.slice(1).reduce((sum,x)=>sum+x.gallons,0);return gallons>0&&miles>=0?{miles,gallons,mpg:miles/gallons}:null}
