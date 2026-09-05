import { describe, expect, it } from "vitest";
import { reportFileName, reports, reportToCsv } from "@/lib/reports";

describe("reports",()=>{
  it("provides every report advertised by the workspace",()=>{
    expect(reports).toHaveLength(12);
    expect(new Set(reports.map(report=>report.id)).size).toBe(12);
    expect(reports.every(report=>report.rows.length>0)).toBe(true);
  });

  it("exports report rows and period as CSV",()=>{
    const csv=reportToCsv(reports[0],"Quarter 3, 2026");
    expect(csv.split("\n")).toHaveLength(reports[0].rows.length+1);
    expect(csv).toContain('Profit & loss,"Quarter 3, 2026",Previous period');
    expect(csv).toContain("Net profit,65440,47810");
  });

  it("escapes spreadsheet formulas in user-controlled labels",()=>{
    const csv=reportToCsv({id:"custom",name:"Custom",description:"",rows:[{label:"=1+1",current:-5}]},"September 2026");
    expect(csv).toContain("'=1+1,-5,");
  });

  it("creates a safe descriptive filename",()=>{
    expect(reportFileName(reports[0],"Quarter 3, 2026")).toBe("profit-loss-quarter-3-2026.csv");
  });
});
