import { beforeEach, describe, expect, it, vi } from "vitest";

const { client, query, redirect } = vi.hoisted(() => ({
  client: { auth: { getClaims: vi.fn() }, from: vi.fn() },
  query: { select: vi.fn(), eq: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn() },
  redirect: vi.fn((path: string) => { throw new Error(`Redirect: ${path}`); }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => client }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/components/app-shell", () => ({ AppShell: () => null }));
vi.mock("@/components/onboarding/company-onboarding", () => ({ CompanyOnboarding: () => null }));
import WorkspacePage from "@/app/workspace/page";
import OnboardingPage from "@/app/onboarding/page";

beforeEach(() => {
  vi.clearAllMocks();
  client.auth.getClaims.mockResolvedValue({ data: { claims: { sub: "user-a" } }, error: null });
  client.from.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.limit.mockReturnValue(query);
});

function results(membership: object | null, failedTable?: "profiles" | "company_memberships") {
  query.maybeSingle.mockResolvedValueOnce({
    data: failedTable === "profiles" ? null : { full_name: "Test owner" },
    error: failedTable === "profiles" ? { message: "Database unavailable" } : null,
  }).mockResolvedValueOnce({
    data: membership,
    error: failedTable === "company_memberships" ? { message: "Database unavailable" } : null,
  });
}

describe("workspace entry during database failures", () => {
  for (const [name, page] of [["workspace", WorkspacePage], ["onboarding", OnboardingPage]] as const) {
    for (const table of ["profiles", "company_memberships"] as const) {
      it(`${name} fails safely when ${table} cannot be loaded`, async () => {
        results(null, table);
        await expect(page()).rejects.toThrow("Please try again");
        expect(redirect).not.toHaveBeenCalled();
      });
    }
  }
  it("sends a confirmed non-member to onboarding", async () => {
    results(null);
    await expect(WorkspacePage()).rejects.toThrow("Redirect: /onboarding");
  });
  it("sends an existing member away from onboarding", async () => {
    results({ id: "membership-a" });
    await expect(OnboardingPage()).rejects.toThrow("Redirect: /workspace");
  });
  it("sends drivers to their portal", async () => {
    results({ company_id: "company-a", role: "driver" });
    await expect(WorkspacePage()).rejects.toThrow("Redirect: /driver");
  });
  it("does not query membership for a signed-out user", async () => {
    client.auth.getClaims.mockResolvedValue({ data: null, error: null });
    await expect(WorkspacePage()).rejects.toThrow("Redirect: /login");
    expect(client.from).not.toHaveBeenCalled();
  });
});
