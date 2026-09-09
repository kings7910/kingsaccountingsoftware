// @vitest-environment node
import {beforeEach,expect,it,vi} from "vitest";
const {context,renderPdf}=vi.hoisted(()=>({context:vi.fn(),renderPdf:vi.fn()}));
vi.mock("@/lib/invoice-delivery-context",()=>({invoiceDeliveryContext:context}));
vi.mock("@/lib/invoice-pdf",()=>({renderInvoicePdf:renderPdf}));
import {loadInvoiceTemplate,saveInvoiceTemplate,previewInvoiceTemplate} from "@/app/actions/invoice-template";
import {defaultInvoiceTemplate} from "@/lib/invoice-template";
beforeEach(()=>{vi.clearAllMocks();renderPdf.mockResolvedValue(new Uint8Array([1,2,3]))});
it("checks writer access before persisting a template",async()=>{context.mockRejectedValue(new Error("Finance access required"));await expect(saveInvoiceTemplate("company",defaultInvoiceTemplate)).rejects.toThrow("Finance access");expect(context).toHaveBeenCalledWith("company","send");expect(renderPdf).not.toHaveBeenCalled()});
it("does not save a logo the PDF engine rejects",async()=>{const upsert=vi.fn();context.mockResolvedValue({s:{from:()=>({upsert})}});renderPdf.mockRejectedValue(new Error("Invalid logo"));await expect(saveInvoiceTemplate("company",defaultInvoiceTemplate)).rejects.toThrow("Invalid logo");expect(upsert).not.toHaveBeenCalled()});
it("saves the normalized template only for the authorized company",async()=>{const upsert=vi.fn().mockResolvedValue({error:null});context.mockResolvedValue({s:{from:()=>({upsert})}});const result=await saveInvoiceTemplate("company",{...defaultInvoiceTemplate,businessName:" Custom Freight "});expect(result.businessName).toBe("Custom Freight");expect(upsert).toHaveBeenCalledWith(expect.objectContaining({company_id:"company",settings:result}));expect(renderPdf).toHaveBeenCalledWith(expect.objectContaining({template:result}))});
it("previews unsaved settings without writing them",async()=>{const from=vi.fn();context.mockResolvedValue({s:{from}});await expect(previewInvoiceTemplate("company",defaultInvoiceTemplate)).resolves.toBe("AQID");expect(from).not.toHaveBeenCalled()});
it("fails template loads rather than replacing saved settings with defaults",async()=>{const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({error:{message:"Unavailable"}}),single:vi.fn().mockResolvedValue({data:{legal_name:"Business"},error:null})};context.mockResolvedValue({s:{from:()=>query},role:"owner"});await expect(loadInvoiceTemplate("company")).rejects.toThrow("Unable to load invoice template")});
