import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {BusinessEmailSettings} from "@/components/settings/business-email-settings";
const {load,save,disconnect}=vi.hoisted(()=>({load:vi.fn(),save:vi.fn(),disconnect:vi.fn()}));
vi.mock("@/app/actions/invoice-delivery",()=>({loadBusinessEmailSettings:load,saveBusinessEmailSettings:save,disconnectBusinessEmail:disconnect}));
let container:HTMLDivElement,root:Root;
beforeEach(()=>{(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();container=document.createElement("div");document.body.append(container);root=createRoot(container)});
afterEach(async()=>{await act(async()=>root.unmount());container.remove()});
async function render(){await act(async()=>root.render(createElement(BusinessEmailSettings,{companyId:"company"})))}
it("does not allow email configuration writes after a failed read",async()=>{load.mockRejectedValue(new Error("Read unavailable"));await render();expect(container.textContent).toContain("Read unavailable");expect(container.querySelectorAll("input")).toHaveLength(0);expect(save).not.toHaveBeenCalled()});
it("keeps a configured secret blank and saves it without a replacement",async()=>{
 load.mockResolvedValue({configured:true,senderName:"Accounts",senderEmail:"accounts@example.com"});save.mockResolvedValue(undefined);await render();
 expect(container.querySelector<HTMLInputElement>('input[type="password"]')!.value).toBe("");
 const button=Array.from(container.querySelectorAll("button")).find(item=>item.textContent==="Save email setup")!;
 expect(button.type).toBe("button");await act(async()=>button.click());
 expect(save).toHaveBeenCalledWith("company",{senderName:"Accounts",senderEmail:"accounts@example.com",apiKey:""});expect(container.textContent).toContain("Email setup saved");
});
it("recovers configuration reads through retry",async()=>{load.mockRejectedValueOnce(new Error("Read unavailable")).mockResolvedValueOnce({configured:false,senderName:"",senderEmail:""});await render();await act(async()=>container.querySelector("button")!.click());expect(container.textContent).toContain("Sender not connected");expect(container.textContent).not.toContain("Read unavailable")});
