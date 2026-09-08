import {describe,expect,it} from "vitest";
import {readQueryRows} from "@/lib/read-query-rows";
describe("complete operational history",()=>{
 it("continues until empty even when the API caps pages below the requested size",async()=>{
  const rows=Array.from({length:1201},(_,id)=>({id})),offsets:number[]=[];
  const result=await readQueryRows(async offset=>{offsets.push(offset);return{data:rows.slice(offset,offset+100),error:null}});
  expect(result.data).toEqual(rows);expect(offsets.at(-1)).toBe(1201);
 });
 it("rejects a later page failure instead of returning partial records",async()=>{
  await expect(readQueryRows(async offset=>offset?{data:null,error:{message:"Later page failed"}}:{data:[{id:1}],error:null})).rejects.toThrow("Later page failed");
 });
});
