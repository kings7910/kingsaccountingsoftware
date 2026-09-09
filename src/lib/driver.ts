export type TripDraft = { start: string; end: string; loaded: string; empty: string; note: string };
export type DriverFuel = { gallons: string; cost: string; odometer: string; vendor: string };

function isFiniteNumber(value: string) {
  return value.trim() !== "" && Number.isFinite(Number(value));
}

export function validateTrip(draft: TripDraft) {
  const errors: Record<string, string> = {};
  const start = Number(draft.start), end = Number(draft.end);
  const loaded = Number(draft.loaded), empty = Number(draft.empty);
  if (!isFiniteNumber(draft.start) || start < 0) {
    errors.start = "Enter a valid starting odometer reading.";
  }
  if (!isFiniteNumber(draft.end) || end < 0 || end < start) {
    errors.end = "Ending odometer must follow the starting reading.";
  }
  if (!isFiniteNumber(draft.loaded) || !isFiniteNumber(draft.empty) || loaded < 0 || empty < 0) {
    errors.miles = "Enter valid loaded and empty miles, using zero when applicable.";
  }
  if (!Object.keys(errors).length && Math.abs(end - start - loaded - empty) > 5) {
    errors.miles = "Loaded and empty miles must match the odometer change.";
  }
  return errors;
}

export function validateDriverFuel(value: DriverFuel) {
  const errors: Record<string, string> = {};
  if (!value.vendor.trim()) errors.vendor = "Vendor is required.";
  if (!isFiniteNumber(value.gallons) || Number(value.gallons) <= 0) {
    errors.gallons = "Gallons must be a number greater than zero.";
  }
  if (!isFiniteNumber(value.cost) || Number(value.cost) <= 0) {
    errors.cost = "Cost must be a number greater than zero.";
  }
  if (!isFiniteNumber(value.odometer) || Number(value.odometer) < 0) {
    errors.odometer = "Enter a valid, nonnegative odometer reading.";
  }
  return errors;
}
