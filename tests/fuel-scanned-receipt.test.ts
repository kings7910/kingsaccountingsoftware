import {act,createElement,useState} from "react";
import {createRoot,type Root} from "react-dom/client";
import {afterEach,expect,it,vi} from "vitest";
const actions=vi.hoisted(()=>({listFuelEntries:vi.fn(),saveFuelEntry:vi.fn(),deleteFuelEntry:vi.fn(),listFuelReceipts:vi.fn(),uploadFuelReceipt:vi.fn()}));
vi.mock("@/app/actions/fuel",()=>actions);vi.mock("@/app/actions/fuel-receipts",()=>actions);
vi.mock("@/components/receipts/receipt-scanner",()=>({ReceiptScanner:({onFile,onApply}:{onFile:(f:File)=>void;onApply:(v:unknown)=>void})=>createElement("button",{type:"button",onClick:()=>{onFile(new File(["photo"],"gas.png",{type:"image/png"}));onApply({vendor:"Gas station",date:"2026-09-09",totalCost:40,gallons:10})}},"Use scanned receipt")}));
import {FuelWorkspace} from "@/components/fuel/fuel-workspace";
let root:Root,container:HTMLDivElement;
afterEach(async()=>{if(root)await act(async()=>root.unmount());container?.remove()});
it("keeps a saved fuel entry and offers a photo retry without creating the entry again",async()=>{
 (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 actions.listFuelEntries.mockResolvedValue([]);actions.listFuelReceipts.mockResolvedValue([]);actions.saveFuelEntry.mockImplementation(async(_company,draft)=>({...draft,id:"saved-fuel"}));actions.uploadFuelReceipt.mockRejectedValueOnce(Error("Upload failed")).mockResolvedValue(undefined);
 container=document.createElement("div");document.body.append(container);root=createRoot(container);
 function Harness(){const[open,setOpen]=useState(true);return createElement(FuelWorkspace,{companyId:"company",openCreate:open,onCreateClosed:()=>setOpen(false)})}
 await act(async()=>root.render(createElement(Harness)));
 const click=async(text:string)=>{const button=Array.from(container.querySelectorAll("button")).find(x=>x.textContent===text);expect(button).toBeTruthy();await act(async()=>button!.click())};
 await click("Use scanned receipt");
 const unit=Array.from(container.querySelectorAll("label")).find(label=>label.textContent?.startsWith("Unit number"))!.querySelector("input")!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(unit,"204");unit.dispatchEvent(new Event("input",{bubbles:true}))});
 await click("Save fuel entry");expect(actions.saveFuelEntry).toHaveBeenCalledOnce();expect(container.textContent).toContain("The fuel entry is saved.");expect(container.textContent).toContain("Photo waiting to attach: gas.png");
 actions.listFuelReceipts.mockResolvedValue([{id:"receipt",name:"gas.png",url:"https://example.com/private-receipt"}]);await click("Attach scanned photo to this entry");expect(actions.saveFuelEntry).toHaveBeenCalledOnce();expect(actions.uploadFuelReceipt).toHaveBeenCalledTimes(2);expect(container.querySelector('a[href="https://example.com/private-receipt"]')).toBeTruthy();expect(container.textContent).not.toContain("Photo waiting to attach:");
});
