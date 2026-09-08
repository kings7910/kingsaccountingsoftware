import {describe,expect,it} from "vitest";import {auditToCsv,demoAuditEvents,filterAuditEvents} from "@/lib/audit";
describe("audit history",()=>{it("filters by area and query",()=>{expect(filterAuditEvents(demoAuditEvents,"Kendra","approval")).toHaveLength(1);expect(filterAuditEvents(demoAuditEvents,"JE-1042","All")[0].action).toBe("journal.posted")});it("exports immutable event details",()=>{const csv=auditToCsv([demoAuditEvents[0]]);expect(csv).toContain("Occurred at,Actor,Action");expect(csv).toContain("RCT-0841");expect(csv).toContain('"{""status"":""Pending""}"')});it("orders newest events first",()=>{const result=filterAuditEvents([...demoAuditEvents].reverse(),"","All");expect(result[0].id).toBe("evt-1")})});

describe("spreadsheet export safety",()=>{
  it("neutralizes formulas in user supplied fields",()=>{
    for(const actor of ['=1+1','+SUM(A1)','-1+2','@SUM(A1)','  =1+1','\t=1+1']){
      expect(auditToCsv([{...demoAuditEvents[0],actor}])).toContain(`'${actor}`);
    }
  });
  it("quotes carriage returns, commas, and quotes without changing JSON values",()=>{
    const csv=auditToCsv([{...demoAuditEvents[0],actor:'Smith, "Jo"\rOffice'}]);
    expect(csv).toContain('"Smith, ""Jo""\rOffice"');
    expect(csv).toContain('"{""status"":""Pending""}"');
  });
});
