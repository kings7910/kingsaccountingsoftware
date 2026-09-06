import { describe,expect,it } from "vitest";
import { estimatedPayroll, fuelMetrics, invoiceTotals, isBalancedJournal, mileageTotal, periodChange, routeProfit } from "@/lib/calculations";
describe("financial calculations",()=>{
  it("calculates invoices without hard-coded tax",()=>expect(invoiceTotals([{quantity:2,unitPrice:100,taxRate:.075}],5)).toEqual({subtotal:200,tax:15,total:210}));
  it("calculates mileage and rejects reversed odometers",()=>{expect(mileageTotal(100,175)).toBe(75);expect(()=>mileageTotal(175,100)).toThrow()});
  it("calculates fuel efficiency",()=>expect(fuelMetrics(100,400,650)).toEqual({pricePerGallon:4,milesPerGallon:6.5,fuelCostPerMile:.62}));
  it("estimates payroll",()=>expect(estimatedPayroll(2000,425,180)).toBe(1755));
  it("requires balanced journals",()=>{expect(isBalancedJournal([{debit:100,credit:0},{debit:0,credit:100}])).toBe(true);expect(isBalancedJournal([{debit:99,credit:0},{debit:0,credit:100}])).toBe(false)});
  it("calculates route profitability",()=>expect(routeProfit(5000,3200,1000)).toEqual({profit:1800,revenuePerMile:5,costPerMile:3.2}));
  it("labels period changes without inventing a baseline",()=>{expect(periodChange(120,100)).toBe("+20.0%");expect(periodChange(80,100)).toBe("−20.0%");expect(periodChange(50,0)).toBe("New this month");expect(periodChange(0,0)).toBe("No change");expect(()=>periodChange(Infinity,100)).toThrow("finite")});
});
