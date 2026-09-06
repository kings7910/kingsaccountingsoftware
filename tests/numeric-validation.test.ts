import {describe,expect,it} from "vitest";
import {validateJournal} from "@/lib/accounting";
import {validateVehicle,demoVehicles} from "@/lib/fleet";
import {validateFuelEntry} from "@/lib/fuel";
import {validateInvoice} from "@/lib/invoices";
import {validateWorkOrder,demoWorkOrders} from "@/lib/maintenance";
import {validateLoad,demoLoads} from "@/lib/operations";
import {validateSettlement,demoSettlements} from "@/lib/payroll";
import {defaultSettings,validateSettings} from "@/lib/settings";

describe("financial input validation",()=>{
  it("rejects non-finite invoice and load calculations",()=>{
    const invoice={customer:"Acme",issuedOn:"2026-09-01",dueOn:"2026-09-30",status:"Draft" as const,notes:"",items:[{id:"1",description:"Freight",quantity:Infinity,unitPrice:100,taxRate:0}]};
    expect(validateInvoice(invoice).items).toBeTruthy();
    expect(validateInvoice({...invoice,items:[{...invoice.items[0],quantity:1,unitPrice:NaN}]}).items).toBeTruthy();
    expect(validateLoad({...demoLoads[0],rate:Infinity}).rate).toBeTruthy();
    expect(validateLoad({...demoLoads[0],plannedMiles:NaN}).plannedMiles).toBeTruthy();
  });

  it("rejects non-finite fleet, fuel, maintenance, and payroll values",()=>{
    expect(validateVehicle({...demoVehicles[0],odometer:NaN},demoVehicles,demoVehicles[0].id).odometer).toBeTruthy();
    expect(validateVehicle({...demoVehicles[0],year:2020.5},demoVehicles,demoVehicles[0].id).year).toBeTruthy();
    expect(validateFuelEntry({date:"2026-09-01",unit:"1",vendor:"Fuel",location:"",gallons:Infinity,totalCost:10,odometer:1,state:"",receiptReference:""}).gallons).toBeTruthy();
    expect(validateWorkOrder({...demoWorkOrders[0],estimatedCost:NaN},demoWorkOrders,demoWorkOrders[0].id).cost).toBeTruthy();
    expect(validateSettlement({...demoSettlements[0],grossPay:Infinity}).amount).toBeTruthy();
    expect(validateSettlement({...demoSettlements[0],loads:1.5}).amount).toBeTruthy();
  });

  it("rejects non-finite settings and journal lines",()=>{
    expect(validateSettings({...defaultSettings,mileageRate:NaN}).mileageRate).toBeTruthy();
    const journal={number:"JE-1",date:"2026-09-01",memo:"Invalid",lines:[
      {id:"1",account:"1000 · Cash",description:"",debit:Infinity,credit:0},
      {id:"2",account:"3000 · Owner’s equity",description:"",debit:0,credit:Infinity},
    ]};
    expect(validateJournal(journal,[])).toMatchObject({lines:expect.any(String),balance:expect.any(String)});
  });
});
