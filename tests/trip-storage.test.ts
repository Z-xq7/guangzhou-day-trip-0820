import { describe, expect, it } from "vitest";
import {
  clearTripState,
  defaultTripState,
  LEGACY_STORAGE_KEY,
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

  removeItem(key: string) {
    this.values.delete(key);
  }
}

class ThrowingStorage {
  getCalls: string[] = [];
  setCalls: string[] = [];
  removeCalls: string[] = [];

  getItem(key: string): string | null {
    this.getCalls.push(key);
    throw new DOMException("Blocked", "SecurityError");
  }

  setItem(key: string) {
    this.setCalls.push(key);
    throw new DOMException("Blocked", "SecurityError");
  }

  removeItem(key: string) {
    this.removeCalls.push(key);
    throw new DOMException("Blocked", "SecurityError");
  }
}

describe("trip state storage", () => {
  it("persists version 2 including the active mobile view", () => {
    const storage = new MemoryStorage();
    const state = {
      version: 2 as const,
      scenario: "rain" as const,
      completedStopIds: ["tea"],
      bookingIds: ["train-outbound"],
      activeView: "map" as const,
    };

    saveTripState(storage, state);

    expect(loadTripState(storage)).toEqual(state);
  });

  it("migrates version 1 without losing trip progress", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({
      version: 1,
      scenario: "delay",
      completedStopIds: ["chen-clan"],
      bookingIds: ["cruise-ticket"],
    }));

    expect(loadTripState(storage)).toEqual({
      version: 2,
      scenario: "delay",
      completedStopIds: ["chen-clan"],
      bookingIds: ["cruise-ticket"],
      activeView: "route",
    });
  });

  it("migrates a valid version 1 record when the version 2 record is invalid", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "not-json");
    storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({
      version: 1,
      scenario: "rain",
      completedStopIds: ["tea"],
      bookingIds: ["train-outbound"],
    }));

    expect(loadTripState(storage)).toEqual({
      version: 2,
      scenario: "rain",
      completedStopIds: ["tea"],
      bookingIds: ["train-outbound"],
      activeView: "route",
    });
  });

  it("clears both current and legacy records", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "current");
    storage.setItem(LEGACY_STORAGE_KEY, "legacy");
    clearTripState(storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
  });

  it("reports SecurityError fallback for load, save, and both clear records", () => {
    const storage = new ThrowingStorage();
    const state = {
      ...defaultTripState,
      scenario: "rain" as const,
      completedStopIds: ["tea"],
    };

    expect(loadTripState(storage)).toEqual(defaultTripState);
    expect(saveTripState(storage, state)).toBe(false);
    expect(clearTripState(storage)).toBe(false);
    expect(storage.getCalls).toEqual([STORAGE_KEY]);
    expect(storage.setCalls).toEqual([STORAGE_KEY]);
    expect(storage.removeCalls).toEqual([STORAGE_KEY, LEGACY_STORAGE_KEY]);
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
      JSON.stringify({
        version: 3,
        scenario: "normal",
        completedStopIds: [],
        bookingIds: [],
        activeView: "route",
      }),
    );

    expect(loadTripState(storage)).toEqual(defaultTripState);
  });

  it("rejects records whose completed-stop IDs are not strings", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      scenario: "normal",
      completedStopIds: [1],
      bookingIds: [],
      activeView: "route",
    }));

    expect(loadTripState(storage)).toEqual(defaultTripState);
  });

  it("rejects records whose booking IDs are not strings", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      scenario: "normal",
      completedStopIds: [],
      bookingIds: [1],
      activeView: "route",
    }));

    expect(loadTripState(storage)).toEqual(defaultTripState);
  });

  it("rejects records with an invalid scenario", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      scenario: "sunny",
      completedStopIds: [],
      bookingIds: [],
      activeView: "route",
    }));

    expect(loadTripState(storage)).toEqual(defaultTripState);
  });

  it("rejects records with an invalid active mobile view", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      scenario: "normal",
      completedStopIds: [],
      bookingIds: [],
      activeView: "gallery",
    }));

    expect(loadTripState(storage)).toEqual(defaultTripState);
  });
});
