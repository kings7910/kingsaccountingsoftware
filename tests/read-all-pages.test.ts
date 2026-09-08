import {expect,it} from "vitest";
import {readAllPages} from "@/lib/read-all-pages";
it("rejects repeated cursors instead of looping indefinitely",async()=>{await expect(readAllPages(async()=>({data:[{id:"a"}],error:null}))).rejects.toThrow("Records changed")});
it("propagates failures on a later page instead of returning partial data",async()=>{await expect(readAllPages(async after=>after?{data:null,error:{message:"Page failed"}}:{data:[{id:"a"}],error:null})).rejects.toThrow("Page failed")});
