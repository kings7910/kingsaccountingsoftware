/** Complete a sorted list without treating the API row limit as the end of history. */
export async function readQueryRows<T>(fetchPage:(offset:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>):Promise<{data:T[];error:{message:string}|null}>{
 const data:T[]=[];
 for(;;){
  const result=await fetchPage(data.length);
  if(result.error)throw new Error(result.error.message);
  if(!result.data?.length)return{data,error:null};
  data.push(...result.data);
 }
}
