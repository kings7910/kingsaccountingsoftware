import {beforeEach,describe,expect,it,vi} from "vitest";
import {listInvoices} from "@/app/actions/invoices";
const {createClient}=vi.hoisted(()=>({createClient:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient}));
const row=(n:number)=>({id:`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`,invoice_number:n,issued_on:"2026-09-01",due_on:"2026-09-30",status:"sent",notes:"",total:100,ledger_managed:true,customer:{name:"Customer"},journal:{entry_number:n},items:[],payments:[],credits:[]});
function setup(data:ReturnType<typeof row>[],role="owner",error:unknown=null){
 const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),limit:vi.fn().mockReturnThis(),or:vi.fn().mockReturnThis(),then:(resolve:(x:unknown)=>unknown)=>Promise.resolve({data,error}).then(resolve)};
 const membership={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{role},error:null})};
 const from=vi.fn((table:string)=>table==="invoices"?query:membership);
 createClient.mockResolvedValue({auth:{getClaims:vi.fn().mockResolvedValue({data:{claims:{sub:"owner"}},error:null})},from});return{query,from};
}
beforeEach(()=>vi.clearAllMocks());
describe("invoice history paging",()=>{
 it("keeps lookahead out of the visible page and preserves equal-date order",async()=>{
  const data=Array.from({length:51},(_,i)=>row(100-i));setup(data);
  const page=await listInvoices("company");expect(page.items).toHaveLength(50);expect(page.nextCursor).toEqual({issuedOn:"2026-09-01",id:data[49].id});
  const {query}=setup([row(50)]);const last=await listInvoices("company",page.nextCursor!);
  expect(query.or).toHaveBeenCalledWith(`issued_on.lt.2026-09-01,and(issued_on.eq.2026-09-01,id.lt.${data[49].id})`);expect(last.items[0].id).toBe(row(50).id);expect(last.nextCursor).toBeNull();
 });
 it("rechecks finance membership on older pages",async()=>{const{from}=setup([],"driver");await expect(listInvoices("company",{issuedOn:"2026-09-01",id:row(1).id})).rejects.toThrow("Finance access required");expect(from).not.toHaveBeenCalledWith("invoices")});
 it("rejects cursor filter injection",async()=>{const{query}=setup([]);await expect(listInvoices("company",{issuedOn:"2026-09-01),company_id.neq.other",id:row(1).id})).rejects.toThrow("Invalid invoice page");expect(query.or).not.toHaveBeenCalled()});
 it("does not turn a failed older page into an empty success",async()=>{setup([],"owner",{message:"Read unavailable"});await expect(listInvoices("company",{issuedOn:"2026-09-01",id:row(1).id})).rejects.toThrow("Read unavailable")});
});
