import { describe, expect, it } from "vitest";
import { authRedirect, safeAuthDestination } from "@/lib/auth-routing";

describe("confirmation redirect destinations", () => {
  it.each([null, "", "https://external.test", "//external.test", "/\\external.test", "/\n/external.test", "/\t/external.test", "javascript:alert(1)"])("rejects unsafe destination %j", (value) => {
    expect(safeAuthDestination(value)).toBe("/workspace");
  });
  it.each(["/workspace", "/reset-password", "/driver?load=123", "/workspace#reports"])("preserves internal destination %s", (value) => {
    expect(safeAuthDestination(value)).toBe(value);
    expect(new URL(safeAuthDestination(value), "https://kings.test").origin).toBe("https://kings.test");
  });
});

describe("auth route decisions", () => {
  it("protects the workspace", () => expect(authRedirect("/workspace", false)).toBe("/login"));
  it("protects nested workspace routes", () => expect(authRedirect("/workspace/reports", false)).toBe("/login"));
  it("protects onboarding", () => expect(authRedirect("/onboarding", false)).toBe("/login"));
  it("protects password updates", () => expect(authRedirect("/reset-password", false)).toBe("/login"));
  it("protects the driver portal", () => expect(authRedirect("/driver", false)).toBe("/login"));
  it("keeps public demo routes available", () => expect(authRedirect("/", false)).toBeNull());
  it("keeps login available to signed-out users", () => expect(authRedirect("/login", false)).toBeNull());
  it("moves authenticated users past login", () => expect(authRedirect("/login", true)).toBe("/workspace"));
  it("allows authenticated workspace access", () => expect(authRedirect("/workspace", true)).toBeNull());
  it("allows authenticated onboarding access", () => expect(authRedirect("/onboarding", true)).toBeNull());
  it("allows authenticated password updates", () => expect(authRedirect("/reset-password", true)).toBeNull());
});
