import {describe,expect,it,vi} from "vitest";
import {probeSupabase} from "@/lib/health";

describe("Supabase health probe",()=>{
  it("reports missing configuration without making a request",async()=>{const fetcher=vi.fn();expect(await probeSupabase(undefined,undefined,fetcher as unknown as typeof fetch)).toMatchObject({database:false,auth:false,error:"Supabase is not configured"});expect(fetcher).not.toHaveBeenCalled()});
  it("checks both PostgREST and Auth",async()=>{const fetcher=vi.fn().mockResolvedValue({ok:true});const result=await probeSupabase("https://example.supabase.co/","key",fetcher as unknown as typeof fetch);expect(result).toMatchObject({database:true,auth:true});expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls.map(call=>call[0])).toEqual(["https://example.supabase.co/rest/v1/","https://example.supabase.co/auth/v1/health"])});
  it("fails readiness when either service is unavailable",async()=>{const fetcher=vi.fn().mockResolvedValueOnce({ok:true}).mockResolvedValueOnce({ok:false});expect(await probeSupabase("https://example.supabase.co","key",fetcher as unknown as typeof fetch)).toMatchObject({database:true,auth:false,error:"One or more Supabase services are unavailable"})});
});
