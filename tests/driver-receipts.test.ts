import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const actions=vi.hoisted(()=>({loadDriverPortal:vi.fn(),uploadDriverReceipt:vi.fn(),submitDriverTrip:vi.fn(),submitDriverFuel:vi.fn(),reportDriverIssue:vi.fn()}));
vi.mock("@/app/actions/driver",()=>actions);
import DriverPortal from "@/app/driver/page";
let container:HTMLDivElement,root:Root;
const button=(name:string)=>Array.from(container.querySelectorAll("button")).find(b=>b.textContent===name)!;
async function select(label:string,file:File){const input=container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;Object.defineProperty(input,"files",{value:[file],configurable:true});await act(async()=>input.dispatchEvent(new Event("change",{bubbles:true})));return input}
beforeEach(async()=>{
 (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 vi.clearAllMocks();localStorage.clear();
 actions.loadDriverPortal.mockResolvedValue({driverId:"driver",name:"Test Driver",initials:"TD",loadId:"load",loadNumber:"L1",status:"dispatched",origin:"A",destination:"B",pickupDetail:"",deliveryDetail:"",unit:"1",trailer:"2",vehicle:"Truck",odometer:100,nextService:200,receipts:[]});
 container=document.createElement("div");document.body.append(container);root=createRoot(container);
 await act(async()=>root.render(createElement(DriverPortal)));await act(async()=>button("Receipts").click());
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove()});
it("opens separate camera and upload pickers, with camera capture only on the photo input",async()=>{
 const camera=container.querySelector<HTMLInputElement>('[aria-label="Take receipt photo"]')!,upload=container.querySelector<HTMLInputElement>('[aria-label="Choose receipt file"]')!;
 expect(camera.getAttribute("capture")).toBe("environment");expect(camera.accept).toBe("image/*");expect(upload.hasAttribute("capture")).toBe(false);expect(upload.accept).toContain("application/pdf");
 const cameraClick=vi.spyOn(camera,"click"),uploadClick=vi.spyOn(upload,"click");
 await act(async()=>button("Scan with camera").click());expect(cameraClick).toHaveBeenCalledOnce();
 await act(async()=>button("Upload receipt").click());expect(uploadClick).toHaveBeenCalledOnce();
});
it.each([["Take receipt photo","image/jpeg","photo.jpg"],["Choose receipt file","application/pdf","receipt.pdf"]])("saves %s to the active load and displays confirmation",async(label,type,name)=>{
 actions.uploadDriverReceipt.mockResolvedValue(`${name} · Saved`);
 const file=new File(["receipt"],name,{type});const input=await select(label,file);
 expect(actions.uploadDriverReceipt).toHaveBeenCalledWith("load",expect.any(FormData));expect(actions.uploadDriverReceipt.mock.calls[0][1].get("file")).toBe(file);expect(input.value).toBe("");expect(container.textContent).toContain(`${name} · Saved`);expect(container.textContent).toContain("Receipt uploaded for review.");
});
it("rejects oversized and unsupported files before uploading",async()=>{
 await select("Choose receipt file",new File(["bad"],"receipt.exe",{type:"application/octet-stream"}));expect(container.querySelector('[role="alert"]')?.textContent).toContain("Use a JPEG");
 await select("Take receipt photo",new File([new Uint8Array(4*1024*1024+1)],"large.jpg",{type:"image/jpeg"}));expect(container.querySelector('[role="alert"]')?.textContent).toContain("4 MB");expect(actions.uploadDriverReceipt).not.toHaveBeenCalled();
});
it("blocks duplicate selections while uploading and allows retry after failure",async()=>{
 let reject!:(reason:Error)=>void;actions.uploadDriverReceipt.mockReturnValueOnce(new Promise((_,r)=>{reject=r}));
 const file=new File(["photo"],"photo.jpg",{type:"image/jpeg"});await select("Take receipt photo",file);
 expect(button("Scan with camera").disabled).toBe(true);expect(button("Upload receipt").disabled).toBe(true);expect(container.textContent).toContain("Uploading receipt…");
 await select("Choose receipt file",file);expect(actions.uploadDriverReceipt).toHaveBeenCalledOnce();
 await act(async()=>reject(new Error("Connection interrupted")));expect(container.querySelector('[role="alert"]')?.textContent).toBe("Connection interrupted");expect(button("Upload receipt").disabled).toBe(false);
 actions.uploadDriverReceipt.mockResolvedValue("photo.jpg · Saved");await select("Choose receipt file",file);expect(container.textContent).toContain("photo.jpg · Saved");
});
