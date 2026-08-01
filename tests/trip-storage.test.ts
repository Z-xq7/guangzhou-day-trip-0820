import { describe, expect, it } from "vitest";
import {
  defaultTripState,
  loadTripState,
  saveTripState,
  STORAGE_KEY,
} from "../src/features/trip/trip-storage";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("trip state storage", () => {
  it("persists the selected scenario and completed stops under a versioned key", () => {
    const storage = new MemoryStorage();
    const state = {
      version: 1 as const,
      scenario: "rain" as const,
      completedStopIds: ["tea", "chen-clan"],
      bookingIds: ["train-outbound"],
    };

    saveTripState(storage, state);

    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}")).toEqual(state);
    expect(loadTripState(storage)).toEqual(state);
  });

  it("returns a safe default when saved JSON is malformed", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "not-json");

    expect(loadTripState(storage)).toEqual(defaultTripState);
  });

  it("ignores state written by an incompatible future version", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 2, scenario: "normal", completedStopIds: [] }),
    );

    expect(loadTripState(storage)).toEqual(defaultTripState);
  });
});
