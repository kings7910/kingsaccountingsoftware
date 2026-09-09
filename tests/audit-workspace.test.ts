import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
const {listAuditEvents}=vi.hoisted(()=>({listAuditEvents:vi.fn()}));
vi.mock("@/app/actions/audit",()=>({listAuditEvents}));
import {AuditWorkspace} from "@/components/audit/audit-workspace";
import {demoAuditEvents,type AuditPage} from "@/lib/audit";
let container:HTMLDivElement,root:Root;
const handled=vi.fn();
function deferred(){let resolve!:(value:AuditPage)=>void;const promise=new Promise<AuditPage>(r=>{resolve=r});return {promise,resolve}}
async function render(companyId="company",exportRequested=false){await act(async()=>root.render(createElement(AuditWorkspace,{companyId,exportRequested,onExportHandled:handled})))}
async function click(text:string){const button=Array.from(container.querySelectorAll("button")).find(b=>b.textContent?.includes(text));expect(button).toBeTruthy();await act(async()=>button!.click())}
beforeEach(()=>{
  (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  vi.clearAllMocks();container=document.createElement("div");document.body.append(container);root=createRoot(container);
  vi.stubGlobal("URL",{createObjectURL:vi.fn(()=>"blob:test"),revokeObjectURL:vi.fn()});
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals()});
describe("audit history recovery",()=>{
  it("does not export an initial failed read and supports retry",async()=>{
    listAuditEvents.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({events:[demoAuditEvents[0]],nextCursor:null});
    await render("company",true);expect(URL.createObjectURL).not.toHaveBeenCalled();expect(container.textContent).toContain("Unable to load audit history");
    await render();await click("Retry");expect(container.textContent).toContain(demoAuditEvents[0].summary);expect(container.textContent).toContain("All available events are loaded");
  });
  it("preserves loaded history and the same cursor when older events fail",async()=>{
    const cursor={id:"cursor",createdAt:"time"};
    listAuditEvents.mockResolvedValueOnce({events:[demoAuditEvents[0]],nextCursor:cursor}).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({events:[demoAuditEvents[1]],nextCursor:null});
    await render();await click("Load older events");expect(container.textContent).toContain(demoAuditEvents[0].summary);
    const exportButton=Array.from(container.querySelectorAll("button")).find(b=>b.textContent?.includes("Export CSV"));expect(exportButton?.disabled).toBe(true);
    await click("Retry older events");expect(container.textContent).toContain("2 matching events");expect(container.textContent).toContain(demoAuditEvents[1].summary);
    expect(listAuditEvents.mock.calls.slice(1)).toEqual([["company",cursor],["company",cursor]]);
  });
  it("ignores old company requests when the company changes",async()=>{
    const old=deferred();listAuditEvents.mockReturnValueOnce(old.promise).mockResolvedValueOnce({events:[demoAuditEvents[1]],nextCursor:null});
    await render("old-company");expect(container.textContent).toContain("Loading audit history");await render("new-company");
    await act(async()=>old.resolve({events:[demoAuditEvents[0]],nextCursor:null}));
    expect(container.textContent).toContain(demoAuditEvents[1].summary);expect(container.textContent).not.toContain(demoAuditEvents[0].summary);
  });
});
