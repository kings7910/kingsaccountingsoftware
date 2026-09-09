/** Read stable ID pages without depending on the API's configured row cap. */
export async function readAllPages<T extends {id:string}>(
  fetchPage:(after:string|null,limit:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>,
):Promise<T[]>{
  const rows:T[]=[];
  let after:string|null=null;
  for(;;){
    const result=await fetchPage(after,500);
    if(result.error)throw new Error(result.error.message);
    const page=result.data??[];
    // An empty page is the only reliable end marker when the API cap is below 500.
    if(!page.length)return rows;
    for(const row of page){
      if(!row.id||(after!==null&&row.id<=after))throw new Error("Records changed while loading. Please retry.");
      rows.push(row);after=row.id;
    }
  }
}
