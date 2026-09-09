import {describe,expect,it} from "vitest";
import {demoWorkOrders,maintenanceSummary,nextWorkOrderStatus,validateWorkOrder} from "@/lib/maintenance";

describe("maintenance workflows",()=>{
  it("summarizes work order activity",()=>expect(maintenanceSummary(demoWorkOrders)).toEqual({open:2,inProgress:1,completed:1,actualCost:1425}));
  it("advances only active work orders",()=>{expect(nextWorkOrderStatus("Scheduled")).toBe("In progress");expect(nextWorkOrderStatus("In progress")).toBe("Completed");expect(nextWorkOrderStatus("Completed")).toBeNull()});
  it("requires unique references and completion dates",()=>{const duplicate={...demoWorkOrders[0],status:"Completed" as const,completedDate:""};const errors=validateWorkOrder(duplicate,demoWorkOrders,"another-id");expect(errors.reference).toBeTruthy();expect(errors.completedDate).toBeTruthy()});
});
