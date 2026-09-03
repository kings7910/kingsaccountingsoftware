import { describe,expect,it } from "vitest";
import { can } from "@/lib/permissions";
describe("permissions",()=>{it("does not expose banking or payroll to drivers",()=>{expect(can("driver","banking.view")).toBe(false);expect(can("driver","payroll.manage")).toBe(false);expect(can("driver","pay_documents.view_own")).toBe(true)});it("gives owners control",()=>expect(can("owner","anything.manage")).toBe(true));it("keeps auditors read-only",()=>{expect(can("auditor","reports.view")).toBe(true);expect(can("auditor","transactions.approve")).toBe(false)})});
