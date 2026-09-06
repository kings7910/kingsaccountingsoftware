import {describe,expect,it} from "vitest";
import {canViewModule,visibleModules} from "@/lib/permissions";

describe("workspace module permissions",()=>{
  it("gives owners the complete workspace",()=>expect(canViewModule("owner","Settings")).toBe(true));
  it("limits payroll managers to payroll-oriented modules",()=>{expect(canViewModule("payroll_manager","Payroll")).toBe(true);expect(canViewModule("payroll_manager","Accounting")).toBe(false)});
  it("keeps audit history restricted",()=>{expect(canViewModule("auditor","Audit log")).toBe(true);expect(canViewModule("accountant","Audit log")).toBe(false)});
  it("allows finance staff and auditors to view payables",()=>{expect(canViewModule("accountant","Bills & payables")).toBe(true);expect(canViewModule("auditor","Bills & payables")).toBe(true);expect(canViewModule("dispatcher","Bills & payables")).toBe(false)});
  it("routes drivers outside the desktop workspace",()=>expect(visibleModules("driver")).toEqual([]));
  it("only shows operational modules backed by each role's server permissions",()=>{
    expect(visibleModules("dispatcher")).toEqual(["Overview","Loads & routes","Approvals","AI assistant"]);
    expect(visibleModules("fleet_manager")).toEqual(["Overview","Fleet","Fuel & mileage","Maintenance","Approvals","AI assistant"]);
  });
  it("treats unknown roles conservatively",()=>{expect(canViewModule("unknown","Reports")).toBe(true);expect(canViewModule("unknown","Team & roles")).toBe(false)});
});
