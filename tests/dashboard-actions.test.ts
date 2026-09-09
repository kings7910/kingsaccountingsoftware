import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {loadDashboard} from "@/app/actions/dashboard";
const {createClient}=vi.hoisted(()=>({createClient:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient}));
type Row=Record<string,unknown>;
function setup(tables:Record<string,Row[]>={},role="owner",failure?:string){
 const calls:string[]=[];
 const from=vi.fn((table:string)=>{
  calls.push(table);let data=tables[table]??[];let limit=100;const orders:{key:string;ascending:boolean}[]=[];
  const value=(row:Row,key:string):unknown=>key.split(".").reduce<unknown>((obj,k)=>(obj as Row)?.[k],row);
  const query={
   select:vi.fn().mockReturnThis(),
   eq:vi.fn((key:string,v:unknown)=>{if(key!=="company_id")data=data.filter(row=>value(row,key)===v);return query}),
   in:vi.fn((key:string,values:unknown[])=>{data=data.filter(row=>values.includes(value(row,key)));return query}),
   not:vi.fn().mockReturnThis(),
   gte:vi.fn((key:string,v:string)=>{data=data.filter(row=>String(value(row,key))>=v);return query}),
   gt:vi.fn((key:string,v:string)=>{data=data.filter(row=>String(value(row,key))>v);return query}),
   lt:vi.fn((key:string,v:string)=>{data=data.filter(row=>String(value(row,key))<v);return query}),
   order:vi.fn((key:string,options?:{ascending:boolean})=>{orders.push({key,ascending:options?.ascending!==false});return query}),
   limit:vi.fn((n:number)=>{limit=Math.min(n,100);return query}),
   maybeSingle:vi.fn().mockResolvedValue({data:{role},error:null}),
   then:(resolve:(r:unknown)=>unknown)=>{
    const sorted=[...data].sort((a,b)=>{for(const order of orders){const c=String(value(a,order.key)).localeCompare(String(value(b,order.key)));if(c)return order.ascending?c:-c}return 0});
    return Promise.resolve({data:sorted.slice(0,limit),error:table===failure?{message:"Database unavailable"}:null}).then(resolve);
   },
  };return query;
 });
 createClient.mockResolvedValue({auth:{getClaims:vi.fn().mockResolvedValue({data:{claims:{sub:"owner"}},error:null})},from});return {from,calls};
}
const id=(n:number)=>String(n).padStart(8,"0");
const line=(n:number,amount:number,date="2026-09-05",status="posted",type="income"):Row=>({id:id(n),debit:type==="expense"?amount:0,credit:type==="income"?amount:0,account:{account_number:type==="income"?"4000":"5000",name:"Account",account_type:type},journal:{id:id(n),entry_date:date,status}});
beforeEach(()=>{vi.clearAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date("2026-09-08T15:00:00Z"))});
afterEach(()=>vi.useRealTimers());
describe("dashboard backend",()=>{
 it("uses posted ledger activity through today and excludes draft and future activity",async()=>{
  setup({journal_lines:[line(1,1000),line(2,200,"2026-09-05","posted","expense"),line(3,500,"2026-08-05"),line(4,9000,"2026-09-09"),line(5,8000,"2026-09-05","draft")],income:[{id:id(1),received_on:"2026-09-05",amount:99999,description:"Unposted",status:"draft"}]});
  const d=await loadDashboard("company");expect(d.stats.slice(0,3).map(x=>x.value)).toEqual(["$1,000","$200","$800"]);expect(d.cashFlow.at(-1)).toEqual({month:"Sep",income:1,expenses:.2});expect(d.stats[0].change).toContain("100");
 });
 it("deducts dated payments and credits, excludes drafts, and does not offset unpaid invoices by customer credits",async()=>{
  setup({invoices:[{id:id(1),issued_on:"2026-09-01",due_on:"2026-09-30",total:1000,status:"sent"},{id:id(2),issued_on:"2026-09-01",due_on:"2026-09-30",total:9999,status:"draft"},{id:id(3),issued_on:"2026-09-01",due_on:"2026-09-30",total:100,status:"paid"}],payments:[{id:id(1),invoice_id:id(1),received_on:"2026-09-02",amount:400},{id:id(2),invoice_id:id(3),received_on:"2026-09-02",amount:100}],credit_notes:[{id:id(1),invoice_id:id(1),credited_on:"2026-09-03",amount:100},{id:id(2),invoice_id:id(3),credited_on:"2026-09-03",amount:50}]});
  const d=await loadDashboard("company");expect(d.stats[3]).toMatchObject({value:"$500",change:"1 invoice with a balance"});
 });
 it("reads beyond 1,000 lines even when the API returns at most 100, and ignores the active-load card in ratios",async()=>{
  setup({journal_lines:Array.from({length:1201},(_,i)=>line(i+1,1)),mileage_logs:[{id:id(1),started_at:"2026-09-02",total_miles:100,loaded_miles:80,status:"approved"},{id:id(2),started_at:"2026-09-03",total_miles:900,status:"pending"},{id:id(3),started_at:"2026-09-09",total_miles:800,status:"approved"}],fuel_entries:[{id:id(1),purchased_at:"2026-09-02",total_cost:50,status:"approved"},{id:id(2),purchased_at:"2026-09-03",total_cost:999,status:"draft"}]});
  const d=await loadDashboard("company");expect(d.stats[0].value).toBe("$1,201");expect(d.fleet).toMatchObject({totalMileage:100,loadedMileage:80,revenuePerMile:12.01,costPerMile:0,fuelCost:50,fuelPerMile:.5});
 });
 it("rejects drivers before reading company dashboard data",async()=>{const {calls}=setup({},"driver");await expect(loadDashboard("company")).rejects.toThrow("Dashboard access required");expect(calls).toEqual(["company_memberships"])});
 it("fails visibly instead of publishing partial totals",async()=>{setup({},"owner","journal_lines");await expect(loadDashboard("company")).rejects.toThrow("Database unavailable")});
});
