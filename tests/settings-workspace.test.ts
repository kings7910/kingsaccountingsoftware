import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {act,createElement} from "react";
import {createRoot,Root} from "react-dom/client";
import {SettingsWorkspace} from "@/components/settings/settings-workspace";
import {productionSettings} from "@/lib/settings";
const {loadCompanySettings,saveCompanySettings}=vi.hoisted(()=>({loadCompanySettings:vi.fn(),saveCompanySettings:vi.fn()}));
vi.mock("@/app/actions/settings",()=>({loadCompanySettings,saveCompanySettings}));
let container:HTMLDivElement,root:Root;
beforeEach(()=>{(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();container=document.createElement("div");document.body.append(container);root=createRoot(container)});
afterEach(async()=>{await act(async()=>root.unmount());container.remove()});
const render=async(saveRequested=false)=>{await act(async()=>root.render(createElement(SettingsWorkspace,{companyId:"real-company",saveRequested,onSaveHandled:()=>{}})))};
it("does not render demo identity or allow saves after a failed company read",async()=>{
 loadCompanySettings.mockRejectedValue(new Error("Read unavailable"));
 await render();expect(container.textContent).toContain("Read unavailable");expect(container.querySelectorAll("input")).toHaveLength(0);
 await render(true);expect(saveCompanySettings).not.toHaveBeenCalled();expect(container.textContent).not.toContain("12-3456789");
});
it("recovers the actual company settings on retry",async()=>{
 loadCompanySettings.mockRejectedValueOnce(new Error("Read unavailable")).mockResolvedValueOnce({...productionSettings,legalName:"Actual Company",dba:"Actual"});
 await render();const retry=Array.from(container.querySelectorAll("button")).find(x=>x.textContent==="Retry")!;
 await act(async()=>retry.click());
 const values=Array.from(container.querySelectorAll("input")).map(x=>x.value);
 expect(values).toContain("Actual Company");expect(values).not.toContain("12-3456789");expect(container.textContent).not.toContain("Read unavailable");
});
