import {beforeEach,expect,it,vi} from "vitest";
const {s,q,storage}=vi.hoisted(()=>{
 const q={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn()};const storage={upload:vi.fn(),remove:vi.fn()};const s={auth:{getClaims:vi.fn()},from:vi.fn(),storage:{from:vi.fn()},rpc:vi.fn()};return{s,q,storage};
});
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>s}));
import {uploadFuelReceipt} from "@/app/actions/fuel-receipts";
beforeEach(()=>{
 vi.resetAllMocks();s.auth.getClaims.mockResolvedValue({data:{claims:{sub:"user"}},error:null});s.from.mockReturnValue(q);q.select.mockReturnValue(q);q.eq.mockReturnValue(q);
 q.maybeSingle.mockResolvedValueOnce({data:{id:"fuel",company_id:"company",driver_id:"driver"},error:null}).mockResolvedValueOnce({data:{role:"owner"},error:null});
 s.storage.from.mockReturnValue(storage);storage.upload.mockResolvedValue({error:null});storage.remove.mockResolvedValue({error:null});s.rpc.mockResolvedValue({error:null});
});
function form(type="application/pdf",size=5){const f=new FormData();f.set("file",new File([new Uint8Array(size)],"gas.pdf",{type}));return f}
it("links uploaded files to the authorized fuel entry",async()=>{await uploadFuelReceipt("fuel",form());expect(s.rpc).toHaveBeenCalledWith("record_fuel_receipt",expect.objectContaining({target_entry_id:"fuel",name_value:"gas.pdf",size_value:5,path_value:expect.stringMatching(/^company\/user\//)}));expect(storage.remove).not.toHaveBeenCalled()});
it("rejects unsigned requests before touching fuel or storage",async()=>{s.auth.getClaims.mockResolvedValue({data:null,error:Error("signed out")});await expect(uploadFuelReceipt("fuel",form())).rejects.toThrow("Authentication required");expect(s.from).not.toHaveBeenCalled();expect(storage.upload).not.toHaveBeenCalled()});
it("rejects inactive company membership before uploading",async()=>{q.maybeSingle.mockReset().mockResolvedValueOnce({data:{id:"fuel",company_id:"company"}}).mockResolvedValueOnce({data:null});await expect(uploadFuelReceipt("fuel",form())).rejects.toThrow("Fuel access required");expect(storage.upload).not.toHaveBeenCalled()});
it("rejects another driver's fuel before uploading",async()=>{q.maybeSingle.mockReset().mockResolvedValueOnce({data:{id:"fuel",company_id:"company",driver_id:"other"}}).mockResolvedValueOnce({data:{role:"driver"}}).mockResolvedValueOnce({data:null});await expect(uploadFuelReceipt("fuel",form())).rejects.toThrow("Fuel access required");expect(q.eq).toHaveBeenCalledWith("profile_id","user");expect(storage.upload).not.toHaveBeenCalled()});
it("cleans up the uploaded object when recording its link fails",async()=>{s.rpc.mockResolvedValue({error:Error("Rejected link")});await expect(uploadFuelReceipt("fuel",form())).rejects.toThrow("Rejected link");expect(storage.remove).toHaveBeenCalledWith([storage.upload.mock.calls[0][0]])});
it.each([["image/heic",5],["application/pdf",4*1024*1024+1]])("rejects unsupported or oversized receipts",async(type,size)=>{await expect(uploadFuelReceipt("fuel",form(type,size))).rejects.toThrow();expect(storage.upload).not.toHaveBeenCalled()});
