"use server";
import {readQueryRows} from "@/lib/read-query-rows";
import {createClient} from "@/lib/supabase/server";

export type WorkspaceNotification={id:string;title:string;body:string;kind:string;read:boolean;createdAt:string};

async function authenticatedClient(){const supabase=await createClient();if(!supabase)throw new Error("Supabase is not configured.");const{data,error}=await supabase.auth.getClaims();if(error||typeof data?.claims?.sub!=="string")throw new Error("Authentication required.");return{supabase,userId:data.claims.sub}}

export async function listNotifications(companyId:string):Promise<WorkspaceNotification[]>{const{supabase,userId}=await authenticatedClient(),{data,error}=await readQueryRows(offset=>supabase.from("notifications").select("id,title,body,kind,read_at,created_at").eq("company_id",companyId).eq("user_id",userId).order("created_at",{ascending:false}).order("id").range(offset,offset+499));if(error)throw new Error(error.message);return(data??[]).map(item=>({id:item.id,title:item.title,body:item.body,kind:item.kind,read:Boolean(item.read_at),createdAt:item.created_at}))}

export async function markNotificationsRead(companyId:string,ids?:string[]){const{supabase,userId}=await authenticatedClient();let query=supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("company_id",companyId).eq("user_id",userId).is("read_at",null);if(ids?.length)query=query.in("id",ids);const{error}=await query;if(error)throw new Error(error.message)}
