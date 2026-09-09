import { beforeEach, describe, expect, it, vi } from "vitest";

const { client, driverQuery } = vi.hoisted(() => {
  const driverQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  const client = { auth: { getClaims: vi.fn() }, from: vi.fn(), rpc: vi.fn() };
  return { client, driverQuery };
});
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => client }));
import { submitDriverFuel, submitDriverTrip } from "@/app/actions/driver";

beforeEach(() => {
  vi.resetAllMocks();
  client.auth.getClaims.mockResolvedValue({ data: { claims: { sub: "user-a" } }, error: null });
  client.from.mockReturnValue(driverQuery);
  driverQuery.select.mockReturnValue(driverQuery);
  driverQuery.eq.mockReturnValue(driverQuery);
  driverQuery.maybeSingle.mockResolvedValue({ data: { id: "driver-a", company_id: "company-a" }, error: null });
  client.rpc.mockResolvedValue({ error: null });
});
const trip = { start: "100", end: "250", loaded: "120", empty: "30", note: "" };
const fuel = { gallons: "20", cost: "80", odometer: "250", vendor: "Fuel stop" };

describe("queued driver submission identity", () => {
  it("rejects mileage from a different signed-in driver before calling the database function", async () => {
    await expect(submitDriverTrip("original-load", trip, "driver-b", "request-1")).rejects.toThrow("driver has changed");
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("rejects fuel from a different signed-in driver before calling the database function", async () => {
    await expect(submitDriverFuel("original-load", fuel, "driver-b", "request-1")).rejects.toThrow("driver has changed");
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it("passes the original load to the existing authorized database function", async () => {
    await submitDriverFuel("original-load", fuel, "driver-a", "request-1");
    expect(client.rpc).toHaveBeenCalledWith("submit_driver_submission", expect.objectContaining({ load_id_value: "original-load",request_id_value:"request-1" }));
    expect(driverQuery.eq).toHaveBeenCalledWith("profile_id", "user-a");
  });
  it("rejects missing authentication", async () => {
    client.auth.getClaims.mockResolvedValue({ data: null, error: new Error("Signed out") });
    await expect(submitDriverTrip("original-load", trip, "driver-a", "request-1")).rejects.toThrow("Authentication required");
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
