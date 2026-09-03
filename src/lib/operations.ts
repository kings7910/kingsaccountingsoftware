export const loadStatuses=["Ready","Dispatched","In transit","Delivered"] as const;
export type LoadStatus=(typeof loadStatuses)[number];
export type LoadRecord={id:string;number:string;origin:string;destination:string;customer:string;driver:string;unit:string;rate:number;plannedMiles:number;pickupOn:string;deliveryOn:string;status:LoadStatus};
export type LoadDraft=Omit<LoadRecord,"id"|"number">;

export const demoLoads:LoadRecord[]=[
 {id:"load-2841",number:"LD-2841",origin:"Atlanta, GA",destination:"Dallas, TX",customer:"BlueLine Logistics",driver:"Marcus Hill",unit:"204",rate:4850,plannedMiles:842,pickupOn:"2026-09-03",deliveryOn:"2026-09-04",status:"In transit"},
 {id:"load-2840",number:"LD-2840",origin:"Savannah, GA",destination:"Charlotte, NC",customer:"Northstar Foods",driver:"Dana Brooks",unit:"118",rate:2320,plannedMiles:252,pickupOn:"2026-09-03",deliveryOn:"2026-09-03",status:"Dispatched"},
 {id:"load-2839",number:"LD-2839",origin:"Memphis, TN",destination:"Orlando, FL",customer:"FreshWay Markets",driver:"Luis Rivera",unit:"221",rate:3760,plannedMiles:684,pickupOn:"2026-09-01",deliveryOn:"2026-09-02",status:"Delivered"},
];
export function nextLoadNumber(records:LoadRecord[]){const max=records.reduce((n,x)=>Math.max(n,Number(x.number.replace(/\D/g,""))||0),2800);return `LD-${max+1}`}
export function validateLoad(draft:LoadDraft){const errors:Record<string,string>={};for(const key of ["origin","destination","customer","driver","unit"] as const)if(!draft[key].trim())errors[key]=`${key[0].toUpperCase()+key.slice(1)} is required.`;if(draft.rate<=0)errors.rate="Rate must be greater than zero.";if(draft.plannedMiles<=0)errors.plannedMiles="Miles must be greater than zero.";if(!draft.pickupOn)errors.pickupOn="Pickup date is required.";if(!draft.deliveryOn)errors.deliveryOn="Delivery date is required.";if(draft.pickupOn&&draft.deliveryOn&&draft.deliveryOn<draft.pickupOn)errors.deliveryOn="Delivery cannot be before pickup.";return errors}
export function loadMargin(record:LoadRecord,costPerMile=2.79){return Math.round((record.rate-record.plannedMiles*costPerMile)*100)/100}
