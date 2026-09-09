import { beforeEach, describe, expect, it, vi } from "vitest";
import { driverDraftKey, enqueueDriverSubmission, readDriverDraft, readDriverQueue, removeReviewedSubmission, syncDriverQueue } from "@/lib/driver-queue";

const fuel = { kind: "fuel" as const, data: { gallons: "20", cost: "80", odometer: "250", vendor: "Fuel stop" } };
const trip = { kind: "trip" as const, data: { start: "100", end: "250", loaded: "120", empty: "30", note: "" } };
function makeLocks() {
  let previous: Promise<unknown> = Promise.resolve();
  return { request: vi.fn((_name: string, callback: () => Promise<unknown>) => {
    const next = previous.then(callback);
    previous = next.catch(() => {});
    return next;
  }) } as unknown as Pick<LockManager, "request">;
}
const sender = () => ({ trip: vi.fn().mockResolvedValue(undefined), fuel: vi.fn().mockResolvedValue(undefined) });
beforeEach(() => localStorage.clear());

describe("driver submission queue", () => {
  it("keeps repeated fuel purchases as independent records", () => {
    enqueueDriverSubmission(localStorage, "driver-a", "load-a", fuel);
    enqueueDriverSubmission(localStorage, "driver-a", "load-a", fuel);
    expect(readDriverQueue(localStorage, "driver-a")).toHaveLength(2);
  });

  it("sends the original load and driver, even when a new load has been queued", async () => {
    enqueueDriverSubmission(localStorage, "driver-a", "old-load", trip);
    enqueueDriverSubmission(localStorage, "driver-a", "new-load", fuel);
    const send = sender();
    const result = await syncDriverQueue(localStorage, "driver-a", send, makeLocks());
    expect(send.trip).toHaveBeenCalledWith("old-load", trip.data, "driver-a", expect.any(String));
    expect(send.fuel).toHaveBeenCalledWith("new-load", fuel.data, "driver-a", expect.any(String));
    expect(result).toEqual({ sent: 2, entries: [] });
  });

  it("never reads or sends another driver's records", async () => {
    enqueueDriverSubmission(localStorage, "driver-a", "load-a", fuel);
    const send = sender();
    await syncDriverQueue(localStorage, "driver-b", send, makeLocks());
    expect(send.fuel).not.toHaveBeenCalled();
    expect(readDriverQueue(localStorage, "driver-a")).toHaveLength(1);
  });

  it("isolates drafts by driver and load", () => {
    localStorage.setItem(driverDraftKey("driver-a", "load-a"), JSON.stringify(trip.data));
    expect(readDriverDraft(localStorage, "driver-a", "load-a")).toEqual(trip.data);
    expect(readDriverDraft(localStorage, "driver-b", "load-a")).toBeNull();
    expect(readDriverDraft(localStorage, "driver-a", "load-b")).toBeNull();
  });

  it("does not infer ownership of legacy records", () => {
    localStorage.setItem("kings-driver-fuel", JSON.stringify(fuel.data));
    localStorage.setItem("kings-driver-trip", JSON.stringify(trip.data));
    expect(readDriverQueue(localStorage, "driver-a")).toEqual([]);
    expect(readDriverDraft(localStorage, "driver-a", "load-a")).toBeNull();
    expect(localStorage.length).toBe(2);
  });

  it("retries uncertain submissions with the same request ID", async () => {
    enqueueDriverSubmission(localStorage, "driver-a", "load-a", fuel);
    const send = sender();
    send.fuel.mockRejectedValue(new Error("Response lost"));
    const locks = makeLocks();
    const result = await syncDriverQueue(localStorage, "driver-a", send, locks);
    expect(result.entries[0]).toMatchObject({ state: "review", submission: fuel });
    await syncDriverQueue(localStorage, "driver-a", send, locks);
    expect(send.fuel).toHaveBeenCalledTimes(2);
    expect(send.fuel.mock.calls[0]).toEqual(send.fuel.mock.calls[1]);
  });

  it("persists the uncertain state before the network request starts", async () => {
    enqueueDriverSubmission(localStorage, "driver-a", "load-a", fuel);
    const send = sender();
    send.fuel.mockImplementation(async () => {
      expect(readDriverQueue(localStorage, "driver-a")[0].state).toBe("review");
    });
    await syncDriverQueue(localStorage, "driver-a", send, makeLocks());
  });

  it("serializes competing synchronization calls", async () => {
    enqueueDriverSubmission(localStorage, "driver-a", "load-a", fuel);
    const send = sender(), locks = makeLocks();
    await Promise.all([
      syncDriverQueue(localStorage, "driver-a", send, locks),
      syncDriverQueue(localStorage, "driver-a", send, locks),
    ]);
    expect(send.fuel).toHaveBeenCalledTimes(1);
  });

  it("preserves a new purchase added while another is sending", async () => {
    enqueueDriverSubmission(localStorage, "driver-a", "load-a", fuel);
    const send = sender();
    send.fuel.mockImplementation(async () => { enqueueDriverSubmission(localStorage, "driver-a", "load-b", fuel); });
    await syncDriverQueue(localStorage, "driver-a", send, makeLocks());
    expect(readDriverQueue(localStorage, "driver-a")).toEqual([expect.objectContaining({ loadId: "load-b", state: "pending" })]);
  });

  it("does not send if persistent storage cannot mark the attempt", async () => {
    enqueueDriverSubmission(localStorage, "driver-a", "load-a", fuel);
    const send = sender();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
    try {
      await expect(syncDriverQueue(localStorage, "driver-a", send, makeLocks())).rejects.toThrow("Quota exceeded");
      expect(send.fuel).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
    expect(readDriverQueue(localStorage, "driver-a")[0].state).toBe("pending");
  });

  it("refuses synchronization without cross-tab locking", async () => {
    enqueueDriverSubmission(localStorage, "driver-a", "load-a", fuel);
    const send = sender();
    await expect(syncDriverQueue(localStorage, "driver-a", send, undefined)).rejects.toThrow("cannot safely synchronize");
    expect(send.fuel).not.toHaveBeenCalled();
    expect(readDriverQueue(localStorage, "driver-a")[0].state).toBe("pending");
  });

  it("only removes reviewed entries for the matching driver", async () => {
    const entry = enqueueDriverSubmission(localStorage, "driver-a", "load-a", fuel);
    const locks = makeLocks();
    await removeReviewedSubmission(localStorage, "driver-a", entry.id, locks);
    expect(readDriverQueue(localStorage, "driver-a")).toHaveLength(1);
    const send = sender();
    send.fuel.mockRejectedValue(new Error("Response lost"));
    await syncDriverQueue(localStorage, "driver-a", send, locks);
    await removeReviewedSubmission(localStorage, "driver-b", entry.id, locks);
    expect(readDriverQueue(localStorage, "driver-a")).toHaveLength(1);
    await removeReviewedSubmission(localStorage, "driver-a", entry.id, locks);
    expect(readDriverQueue(localStorage, "driver-a")).toEqual([]);
  });

  it("retains corrupted data without attempting any submissions", async () => {
    const entry = enqueueDriverSubmission(localStorage, "driver-a", "load-a", fuel);
    const key = `kings-driver-queue-v2:driver-a:${entry.id}`;
    localStorage.setItem(key, "broken json");
    const send = sender();
    await expect(syncDriverQueue(localStorage, "driver-a", send, makeLocks())).rejects.toThrow();
    expect(localStorage.getItem(key)).toBe("broken json");
    expect(send.fuel).not.toHaveBeenCalled();
  });

  it("rejects unassigned submissions and malformed drafts", () => {
    expect(() => enqueueDriverSubmission(localStorage, "driver-a", "", fuel)).toThrow("assigned trip");
    localStorage.setItem(driverDraftKey("driver-a", "load-a"), "{}");
    expect(() => readDriverDraft(localStorage, "driver-a", "load-a")).toThrow("could not be read");
  });
});
