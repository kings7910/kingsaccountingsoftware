// @vitest-environment node
import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({context:vi.fn(),document:vi.fn(),admin:vi.fn(),send:vi.fn(),decrypt:vi.fn(),pdf:vi.fn()}));
vi.mock("@/lib/invoice-delivery-context",()=>({invoiceDeliveryContext:mocks.context,loadInvoiceDocument:mocks.document}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:mocks.admin}));
vi.mock("@/lib/email-credentials",()=>({encryptEmailCredential:vi.fn(),decryptEmailCredential:mocks.decrypt}));
vi.mock("@/lib/invoice-pdf",()=>({renderInvoicePdf:mocks.pdf}));
vi.mock("@/lib/invoice-email-provider",async importOriginal=>({...await importOriginal<typeof import("@/lib/invoice-email-provider")>(),sendInvoiceWithResend:mocks.send}));
import {sendInvoiceEmail} from "@/app/actions/invoice-delivery";
const id="90000000-0000-4000-8000-000000000001";
function setup(existing:Record<string,unknown>|null=null,claimed=true){
 const update=vi.fn();
 const rows:Record<string,unknown>={invoice_email_deliveries:existing,company_email_settings:{sender_email:"sender@example.com",sender_name:"Company",encrypted_api_key:"encrypted"},invoice_email_payloads:{payload:{message:{subject:"Frozen original"},credential:"original-credential"}}};
 const from=vi.fn((table:string)=>{const result={data:rows[table],error:null};const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),neq:vi.fn().mockReturnThis(),update:vi.fn((value:unknown)=>{update(value);return query}),maybeSingle:vi.fn().mockResolvedValue(result),single:vi.fn().mockResolvedValue(result),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({error:null}).then(resolve)};return query});
 const rpc=vi.fn().mockResolvedValue({data:claimed,error:null});mocks.admin.mockReturnValue({from,rpc});return{from,rpc,update};
}
beforeEach(()=>{vi.clearAllMocks();mocks.context.mockResolvedValue({uid:"actor"});mocks.decrypt.mockReturnValue("key");mocks.send.mockResolvedValue("provider-id")});
describe("invoice email action",()=>{
 it("checks finance authorization before using privileged credentials",async()=>{mocks.context.mockRejectedValue(new Error("Finance access required."));await expect(sendInvoiceEmail("company","invoice","customer@example.com",id)).rejects.toThrow("Finance access");expect(mocks.admin).not.toHaveBeenCalled()});
 it("returns accepted retries without calling the provider again",async()=>{setup({company_id:"company",invoice_id:"invoice",recipient:"customer@example.com",status:"accepted"});await expect(sendInvoiceEmail("company","invoice","customer@example.com",id)).resolves.toEqual({accepted:true});expect(mocks.send).not.toHaveBeenCalled()});
 it("rejects a request reference belonging to another company",async()=>{setup({company_id:"other",invoice_id:"invoice",recipient:"customer@example.com",status:"unknown"});await expect(sendInvoiceEmail("company","invoice","customer@example.com",id)).rejects.toThrow("different details");expect(mocks.send).not.toHaveBeenCalled()});
 it("uses the frozen message and credential on retry",async()=>{const {update}=setup({company_id:"company",invoice_id:"invoice",recipient:"customer@example.com",status:"unknown"});await sendInvoiceEmail("company","invoice","customer@example.com",id);expect(mocks.document).not.toHaveBeenCalled();expect(mocks.decrypt).toHaveBeenCalledWith("original-credential","company");expect(mocks.send).toHaveBeenCalledWith("key",id,{subject:"Frozen original"});expect(update).toHaveBeenCalledWith(expect.objectContaining({status:"accepted",provider_id:"provider-id"}))});
 it("does not call the provider when a competing request owns the lease",async()=>{setup({company_id:"company",invoice_id:"invoice",recipient:"customer@example.com",status:"processing"},false);await expect(sendInvoiceEmail("company","invoice","customer@example.com",id)).rejects.toThrow("being processed");expect(mocks.send).not.toHaveBeenCalled()});
 it("records uncertain failures for retry without claiming success",async()=>{const{update}=setup({company_id:"company",invoice_id:"invoice",recipient:"customer@example.com",status:"unknown"});mocks.send.mockRejectedValue(new Error("No confirmation"));await expect(sendInvoiceEmail("company","invoice","customer@example.com",id)).rejects.toThrow("No confirmation");expect(update).toHaveBeenCalledWith(expect.objectContaining({status:"unknown"}))});
 it("rejects draft invoices before PDF generation or preparation",async()=>{const{rpc}=setup();mocks.document.mockResolvedValue({posted:false,ledgerManaged:true,status:"draft"});await expect(sendInvoiceEmail("company","invoice","customer@example.com",id)).rejects.toThrow("Issue and post");expect(mocks.pdf).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled()});
});
