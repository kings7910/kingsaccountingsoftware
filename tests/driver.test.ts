import { describe, expect, it } from "vitest";
import { DriverFuel, TripDraft, validateDriverFuel, validateTrip } from "@/lib/driver";

const trip: TripDraft = { start: "100", end: "250", loaded: "120", empty: "30", note: "" };
const fuel: DriverFuel = { vendor: "Fuel stop", gallons: "20", cost: "80", odometer: "250" };

describe("driver portal", () => {
  it("validates consistent trip mileage", () => {
    expect(validateTrip(trip)).toEqual({});
  });

  it("rejects a reversed odometer", () => {
    expect(validateTrip({ ...trip, start: "200", end: "100" })).toHaveProperty("end");
  });

  it("rejects missing mileage allocation even when both mile counts are zero", () => {
    expect(validateTrip({ ...trip, loaded: "0", empty: "0" })).toHaveProperty("miles");
  });

  it("allows zero miles when the vehicle did not move", () => {
    expect(validateTrip({ ...trip, start: "0", end: "0", loaded: "0", empty: "0" })).toEqual({});
  });

  it("accepts the five-mile tolerance but rejects a larger discrepancy", () => {
    expect(validateTrip({ ...trip, end: "255" })).toEqual({});
    expect(validateTrip({ ...trip, end: "255.1" })).toHaveProperty("miles");
  });

  it.each(["", " ", "abc", "NaN", "Infinity", "-Infinity", "1e309", "-1"])(
    "rejects invalid trip readings %j in every numeric field",
    (value) => {
      for (const field of ["start", "end", "loaded", "empty"] as const) {
        expect(Object.keys(validateTrip({ ...trip, [field]: value })).length).toBeGreaterThan(0);
      }
    },
  );

  it("accepts a valid fuel purchase and zero odometer", () => {
    expect(validateDriverFuel(fuel)).toEqual({});
    expect(validateDriverFuel({ ...fuel, odometer: "0" })).toEqual({});
  });

  it("requires a vendor and positive purchase amounts", () => {
    expect(Object.keys(validateDriverFuel({ vendor: " ", gallons: "0", cost: "-1", odometer: "-2" })))
      .toEqual(expect.arrayContaining(["vendor", "gallons", "cost", "odometer"]));
  });

  it.each(["", " ", "abc", "NaN", "Infinity", "-Infinity", "1e309", "-1"])(
    "rejects invalid fuel values %j in every numeric field",
    (value) => {
      for (const field of ["gallons", "cost", "odometer"] as const) {
        expect(validateDriverFuel({ ...fuel, [field]: value })).toHaveProperty(field);
      }
    },
  );
});
