import { describe, expect, it } from "vitest";
import { authRedirect } from "@/lib/auth-routing";

describe("auth route decisions", () => {
  it("protects the workspace", () => expect(authRedirect("/workspace", false)).toBe("/login"));
  it("protects nested workspace routes", () => expect(authRedirect("/workspace/reports", false)).toBe("/login"));
  it("keeps public demo routes available", () => expect(authRedirect("/", false)).toBeNull());
  it("keeps login available to signed-out users", () => expect(authRedirect("/login", false)).toBeNull());
  it("moves authenticated users past login", () => expect(authRedirect("/login", true)).toBe("/workspace"));
  it("allows authenticated workspace access", () => expect(authRedirect("/workspace", true)).toBeNull());
});
