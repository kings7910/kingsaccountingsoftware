import {describe,expect,it} from "vitest";
import {extractReceiptFields,validReceiptDate} from "@/lib/receipt-extraction";
describe("receipt field suggestions",()=>{
 it("reads a labeled fuel receipt without confusing tax, tender, and per-gallon price with total",()=>{
  const result=extractReceiptFields("PILOT TRAVEL CENTER\n123 Main Street\n09/09/2026 12:34\nGALLONS 25.500\nPRICE/GAL $3.899\nSUBTOTAL $99.42\nTAX $1.58\nTOTAL $101.00\nCASH $120.00\nCHANGE $19.00");
  expect(result.suggestions).toEqual({vendor:"PILOT TRAVEL CENTER",date:"2026-09-09",gallons:25.5,totalCost:101,tax:1.58});
 });
 it("accepts ISO dates, grouped USD amounts, and quantities before GAL",()=>{expect(extractReceiptFields("Gas Depot\n2026-09-08\n300.125 GAL\nTOTAL SALE\n$1,234.50").suggestions).toEqual({vendor:"Gas Depot",date:"2026-09-08",gallons:300.125,totalCost:1234.5})});
 it("requires unambiguous totals and does not use a subtotal or card tender",()=>{const result=extractReceiptFields("Gas Stop\nSUBTOTAL $12.00\nVISA $13.00");expect(result.suggestions.totalCost).toBeUndefined();const conflicting=extractReceiptFields("Gas Stop\nTOTAL $12.00\nAMOUNT DUE $15.00");expect(conflicting.suggestions.totalCost).toBeUndefined();expect(conflicting.warnings.join()).toContain("More than one total")});
 it("accepts repeated identical totals and keeps zero tax",()=>{expect(extractReceiptFields("Gas Stop\nTOTAL 10.00\nTOTAL SALE 10.00\nTAX 0.00").suggestions).toMatchObject({totalCost:10,tax:0})});
 it("does not turn a refund, total tax, liter quantity, or unit price into a fuel purchase",()=>{const result=extractReceiptFields("Gas Stop\nTOTAL -$10.00\nTOTAL TAX $2.00\nVOLUME 40 L\nPRICE PER GAL 3.99");expect(result.suggestions.totalCost).toBeUndefined();expect(result.suggestions.gallons).toBeUndefined()});
 it("leaves non-USD amounts for manual review",()=>{const result=extractReceiptFields("Gas Stop\nCAD\nTOTAL $10.00\nTAX $1.00");expect(result.suggestions.totalCost).toBeUndefined();expect(result.suggestions.tax).toBeUndefined();expect(result.warnings.join()).toContain("non-USD")});
 it("does not guess incomplete or impossible dates",()=>{for(const text of ["02/30/2026","09/09","2026-13-01"])expect(extractReceiptFields(text).suggestions.date).toBeUndefined();expect(validReceiptDate("2024-02-29")).toBe(true);expect(validReceiptDate("2025-02-29")).toBe(false)});
 it("recognizes a two-digit US receipt year and skips generic headers",()=>{expect(extractReceiptFields("CUSTOMER COPY\nWELCOME\n*** LOVE'S ***\n09/09/26").suggestions).toMatchObject({vendor:"LOVE'S",date:"2026-09-09"})});
 it("reports unreadable content instead of inventing amounts",()=>{const result=extractReceiptFields("");expect(result.suggestions).toEqual({});expect(result.warnings.join()).toContain("No reliable fields")});
});
