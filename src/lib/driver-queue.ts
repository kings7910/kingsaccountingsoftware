import { z } from "zod";
import { DriverFuel, TripDraft, validateDriverFuel, validateTrip } from "./driver";

const tripSchema = z.object({ start: z.string(), end: z.string(), loaded: z.string(), empty: z.string(), note: z.string() });
const fuelSchema = z.object({ gallons: z.string(), cost: z.string(), odometer: z.string(), vendor: z.string() });
const submissionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("trip"), data: tripSchema }),
  z.object({ kind: z.literal("fuel"), data: fuelSchema }),
]);
const entrySchema = z.object({
  id: z.string().uuid(), driverId: z.string().min(1), loadId: z.string().min(1),
  createdAt: z.string(), retrySafe: z.boolean().optional(), state: z.enum(["pending", "review"]), submission: submissionSchema,
});
export type DriverSubmission = z.infer<typeof submissionSchema>;
export type DriverQueueEntry = z.infer<typeof entrySchema>;
const prefix = "kings-driver-queue-v2:";
const queuePrefix = (driverId: string) => `${prefix}${encodeURIComponent(driverId)}:`;
export const driverDraftKey = (driverId: string, loadId: string) =>
  `kings-driver-draft-v2:${encodeURIComponent(driverId)}:${encodeURIComponent(loadId)}`;

export function readDriverDraft(storage: Storage, driverId: string, loadId: string): TripDraft | null {
  const raw = storage.getItem(driverDraftKey(driverId, loadId));
  if (!raw) return null;
  const result = tripSchema.safeParse(JSON.parse(raw));
  if (!result.success) throw new Error("The saved mileage draft could not be read.");
  return result.data;
}

export function readDriverQueue(storage: Storage, driverId: string): DriverQueueEntry[] {
  if (!driverId) return [];
  const entries: DriverQueueEntry[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(queuePrefix(driverId))) continue;
    const entry = entrySchema.parse(JSON.parse(storage.getItem(key)!));
    if (entry.driverId !== driverId || key !== `${queuePrefix(driverId)}${entry.id}`) {
      throw new Error("A saved submission could not be verified. It has been kept on this device.");
    }
    entries.push(entry);
  }
  return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function enqueueDriverSubmission(storage: Storage, driverId: string, loadId: string, submission: DriverSubmission) {
  if (!driverId || !loadId) throw new Error("Load your assigned trip before submitting.");
  const errors = submission.kind === "trip" ? validateTrip(submission.data) : validateDriverFuel(submission.data);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const entry: DriverQueueEntry = { id: crypto.randomUUID(), driverId, loadId, createdAt: new Date().toISOString(), state: "pending", submission };
  // Separate keys prevent another tab or a second purchase from overwriting an entry.
  storage.setItem(`${queuePrefix(driverId)}${entry.id}`, JSON.stringify(entry));
  return entry;
}

export type DriverQueueSender = {
  trip: (loadId: string, data: TripDraft, driverId: string, requestId: string) => Promise<void>;
  fuel: (loadId: string, data: DriverFuel, driverId: string, requestId: string) => Promise<void>;
};

export async function syncDriverQueue(storage: Storage, driverId: string, sender: DriverQueueSender, locks: Pick<LockManager, "request"> | undefined) {
  if (!locks) throw new Error("This browser cannot safely synchronize saved submissions. Use a current browser on HTTPS.");
  return locks.request(`${queuePrefix(driverId)}sync`, async () => {
    let sent = 0;
    for (const entry of readDriverQueue(storage, driverId)) {
      if (entry.state !== "pending" && !entry.retrySafe) continue;
      const key = `${queuePrefix(driverId)}${entry.id}`;
      // The persisted request ID lets the database acknowledge a retry without a second write.
      storage.setItem(key, JSON.stringify({ ...entry, state: "review", retrySafe: true }));
      try {
        if (entry.submission.kind === "trip") await sender.trip(entry.loadId, entry.submission.data, driverId, entry.id);
        else await sender.fuel(entry.loadId, entry.submission.data, driverId, entry.id);
        storage.removeItem(key);
        sent++;
      } catch {
        // Keep the same request ID for a safe retry; later entries remain pending.
        break;
      }
    }
    return { sent, entries: readDriverQueue(storage, driverId) };
  });
}

export async function removeReviewedSubmission(storage: Storage, driverId: string, entryId: string, locks: Pick<LockManager, "request"> | undefined) {
  if (!locks) throw new Error("This browser cannot safely update saved submissions.");
  await locks.request(`${queuePrefix(driverId)}sync`, async () => {
    const entry = readDriverQueue(storage, driverId).find(x => x.id === entryId);
    if (entry?.state === "review") storage.removeItem(`${queuePrefix(driverId)}${entry.id}`);
  });
}
