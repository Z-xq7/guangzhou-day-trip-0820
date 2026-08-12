import { describe, expect, it } from "vitest";
import {
  clearTripState,
  defaultTripState,
  LEGACY_STORAGE_KEY,
  loadTripState,
  saveTripState,
  STORAGE_KEY,
  V2_STORAGE_KEY,
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
  it("persists version 3 including wishlist and active mobile view", () => {
    const storage = new MemoryStorage();
    const state = {
      version: 3 as const,
      scenario: "rain" as const,
      completedStopIds: ["tea"],
      bookingIds: ["train-outbound"],
      wishlistPlaceIds: ["shamian"],
      activeView: "map" as const,
    };

    saveTripState(storage, state);

    expect(loadTripState(storage)).toEqual(state);
  });

  it("migrates version 2 without losing trip progress", () => {
    const storage = new MemoryStorage();
    storage.setItem(V2_STORAGE_KEY, JSON.stringify({
      version: 2,
      scenario: "rain",
      completedStopIds: ["tea"],
      bookingIds: ["cruise-ticket"],
      activeView: "map",
    }));

    expect(loadTripState(storage)).toEqual({
      version: 3,
      scenario: "rain",
      completedStopIds: ["tea"],
      bookingIds: ["cruise-ticket"],
      wishlistPlaceIds: [],
      activeView: "map",
    });
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
      version: 3,
      scenario: "delay",
      completedStopIds: ["chen-clan"],
      bookingIds: ["cruise-ticket"],
      wishlistPlaceIds: [],
      activeView: "route",
    });
  });

  it("migrates a valid older record when the version 3 record is malformed", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "not-json");
    storage.setItem(V2_STORAGE_KEY, JSON.stringify({
      version: 2,
      scenario: "rain",
      completedStopIds: ["tea"],
      bookingIds: ["train-outbound"],
      activeView: "todo",
    }));

    expect(loadTripState(storage)).toEqual({
      version: 3,
      scenario: "rain",
      completedStopIds: ["tea"],
      bookingIds: ["train-outbound"],
      wishlistPlaceIds: [],
      activeView: "todo",
    });
  });

  it("filters unknown wishlist IDs while preserving known IDs", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({
      ...defaultTripState,
      wishlistPlaceIds: ["shamian", "unknown-place", "shamian"],
    }));

    expect(loadTripState(storage).wishlistPlaceIds).toEqual(["shamian"]);
  });

  it("clears current and both legacy records", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "current");
    storage.setItem(V2_STORAGE_KEY, "v2");
    storage.setItem(LEGACY_STORAGE_KEY, "v1");
    clearTripState(storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem(V2_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
  });

  it("reports SecurityError fallback for load, save, and all clear records", () => {
    const storage = new ThrowingStorage();
    const state = {
      ...defaultTripState,
      scenario: "rain" as const,
      completedStopIds: ["tea"],
    };

    expect(loadTripState(storage)).toEqual(defaultTripState);
    expect(saveTripState(storage, state)).toBe(false);
    expect(clearTripState(storage)).toBe(false);
    expect(storage.getCalls).toEqual([STORAGE_KEY, V2_STORAGE_KEY, LEGACY_STORAGE_KEY]);
    expect(storage.setCalls).toEqual([STORAGE_KEY]);
    expect(storage.removeCalls).toEqual([STORAGE_KEY, V2_STORAGE_KEY, LEGACY_STORAGE_KEY]);
  });

  it("returns a safe default when every saved JSON record is malformed", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "not-json");
    storage.setItem(V2_STORAGE_KEY, "not-json");
    storage.setItem(LEGACY_STORAGE_KEY, "not-json");

    expect(loadTripState(storage)).toEqual(defaultTripState);
  });

  it("ignores state written by an incompatible future version", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 4,
        scenario: "normal",
        completedStopIds: [],
        bookingIds: [],
        wishlistPlaceIds: [],
        activeView: "route",
      }),
    );

    expect(loadTripState(storage)).toEqual(defaultTripState);
  });

  it.each([
    ["completedStopIds", [1]],
    ["bookingIds", [1]],
    ["wishlistPlaceIds", [1]],
  ])("rejects records whose %s are not strings", (field, invalidValue) => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({
      ...defaultTripState,
      [field]: invalidValue,
    }));

    expect(loadTripState(storage)).toEqual(defaultTripState);
  });

  it("rejects records with an invalid scenario", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({
      ...defaultTripState,
      scenario: "sunny",
    }));

    expect(loadTripState(storage)).toEqual(defaultTripState);
  });

  it("rejects records with an invalid active mobile view", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({
      ...defaultTripState,
      activeView: "gallery",
    }));

    expect(loadTripState(storage)).toEqual(defaultTripState);
  });
});
