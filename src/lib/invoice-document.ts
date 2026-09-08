export type InvoiceDocument={
 id:string;number:string;issuedOn:string;dueOn:string;status:string;notes:string;subtotal:number;tax:number;discount:number;total:number;
 ledgerManaged:boolean;posted:boolean;company:{name:string;displayName:string};customer:{name:string;email:string;address:Record<string,unknown>|null};
 items:{description:string;quantity:number;unitPrice:number;taxRate:number}[];payments:number;adjustments:number;credits:number;
};
export function documentBalance(document:InvoiceDocument){return Math.round((document.total-document.payments+document.adjustments-document.credits)*100)/100}
export function billingAddress(address:InvoiceDocument['customer']['address']) {
 if(!address||typeof address!=="object")return [];
 return [address.line1??address.street??address.address, address.line2, [address.city,address.state,address.postalCode??address.postal_code??address.zip].filter(x=>typeof x==="string"&&x.trim()).join(", "),address.country].filter((x):x is string=>typeof x==="string"&&!!x.trim());
}
export function invoiceEmailAddress(value:string){
 const result=value.trim().toLowerCase();
 if(result.length>254||! /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(result))throw new Error("Enter one valid email address.");
 return result;
}
