import {beforeEach,describe,expect,it,vi} from "vitest";
const {createClient}=vi.hoisted(()=>({createClient:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient}));
import {listAuditEvents} from "@/app/actions/audit";

const row=(id:number)=>({id:`00000000-0000-4000-8000-${String(id).padStart(12,"0")}`,created_at:"2026-09-08T12:00:00.123456+00:00",action:"journal.posted",record_type:"journal_entry",record_id:"ref",before_data:null,after_data:{reference:"JE-1"},ip_address:null,actor:{full_name:"Owner"}});
function client(rows:ReturnType<typeof row>[],role="owner",error:unknown=null){
  const audit={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),limit:vi.fn().mockReturnThis(),or:vi.fn().mockReturnThis(),then:(resolve:(data:unknown)=>unknown)=>Promise.resolve({data:rows,error}).then(resolve)};
  const membership={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{role},error:null})};
  const from=vi.fn((table:string)=>table==="audit_logs"?audit:membership);
  createClient.mockResolvedValue({auth:{getClaims:vi.fn().mockResolvedValue({data:{claims:{sub:"user"}}})},from});
  return {audit,from,membership};
}
beforeEach(()=>vi.clearAllMocks());
describe("audit pagination",()=>{
  it("uses a lookahead and preserves timestamp precision in the next cursor",async()=>{
    const rows=Array.from({length:251},(_,i)=>row(300-i));const {audit}=client(rows);
    const page=await listAuditEvents("company");
    expect(page.events).toHaveLength(250);expect(page.nextCursor).toEqual({id:rows[249].id,createdAt:rows[249].created_at});
    expect(audit.eq).toHaveBeenCalledWith("company_id","company");expect(audit.limit).toHaveBeenCalledWith(251);
    expect(audit.order.mock.calls).toEqual([["created_at",{ascending:false}],["id",{ascending:false}]]);
  });
  it("continues through events sharing a timestamp without offset pagination",async()=>{
    const {audit}=client([row(1)]);const cursor={id:row(2).id,createdAt:row(2).created_at};
    const page=await listAuditEvents("company",cursor);
    expect(audit.or).toHaveBeenCalledWith(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
    expect(page.nextCursor).toBeNull();expect(page.events[0].entityReference).toBe("JE-1");
  });
  it("rejects crafted cursors before querying",async()=>{
    await expect(listAuditEvents("company",{id:"anything),company_id.neq.other",createdAt:row(1).created_at})).rejects.toThrow("Invalid audit history cursor");
    expect(createClient).not.toHaveBeenCalled();
  });
  it("checks audit permissions on every page",async()=>{
    const {from}=client([],"accountant");await expect(listAuditEvents("company",{id:row(1).id,createdAt:row(1).created_at})).rejects.toThrow("Audit access required");
    expect(from).not.toHaveBeenCalledWith("audit_logs");
  });
  it("does not present failed reads as empty history",async()=>{
    client([],"owner",{message:"private database detail"});await expect(listAuditEvents("company")).rejects.toThrow("Unable to load audit history");
  });
});
