import { describe, expect, it } from "vitest";
import { readResponseText } from "@/lib/openai";

describe("OpenAI response parsing", () => {
  it("uses the output_text shortcut", () => {
    expect(readResponseText({ output_text: "  Reconcile the bank account.  " })).toBe("Reconcile the bank account.");
  });

  it("collects output text content safely", () => {
    expect(readResponseText({ output: [{ content: [{ type: "output_text", text: "First" }, { type: "refusal", text: "ignored" }] }, { content: [{ type: "output_text", text: "Second" }] }] })).toBe("First\n\nSecond");
  });
});
