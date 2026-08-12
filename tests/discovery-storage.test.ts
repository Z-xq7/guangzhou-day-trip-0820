// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");

afterEach(() => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(window, "localStorage", originalLocalStorageDescriptor);
  }
  window.localStorage.clear();
  vi.resetModules();
});

describe("discovery wishlist storage", () => {
  it("keeps wishlist toggles usable in memory when localStorage throws SecurityError", async () => {
    const throwingStorage = {
      getItem: vi.fn(() => { throw new DOMException("Blocked", "SecurityError"); }),
      setItem: vi.fn(() => { throw new DOMException("Blocked", "SecurityError"); }),
      removeItem: vi.fn(() => { throw new DOMException("Blocked", "SecurityError"); }),
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: throwingStorage,
    });
    const { getTripStateSnapshot } = await import("../src/features/trip/trip-storage");
    const { toggleWishlistPlace } = await import(
      "../src/features/discovery/discovery-storage"
    );

    toggleWishlistPlace("shamian");
    expect(getTripStateSnapshot().wishlistPlaceIds).toEqual(["shamian"]);

    toggleWishlistPlace("shamian");
    expect(getTripStateSnapshot().wishlistPlaceIds).toEqual([]);
    expect(throwingStorage.setItem).toHaveBeenCalledTimes(2);
  });

  it("clears only wishlist candidates and leaves itinerary progress intact", async () => {
    const { getTripStateSnapshot, updateTripState } = await import(
      "../src/features/trip/trip-storage"
    );
    const { clearWishlist, toggleWishlistPlace } = await import(
      "../src/features/discovery/discovery-storage"
    );
    updateTripState((state) => ({
      ...state,
      completedStopIds: ["tea"],
      bookingIds: ["train-outbound"],
    }));
    toggleWishlistPlace("shamian");
    toggleWishlistPlace("nanxin-dessert");

    clearWishlist();

    expect(getTripStateSnapshot()).toMatchObject({
      completedStopIds: ["tea"],
      bookingIds: ["train-outbound"],
      wishlistPlaceIds: [],
    });
  });

  it("ignores unknown catalog IDs", async () => {
    const { getTripStateSnapshot } = await import("../src/features/trip/trip-storage");
    const { toggleWishlistPlace } = await import(
      "../src/features/discovery/discovery-storage"
    );

    toggleWishlistPlace("unknown-place");

    expect(getTripStateSnapshot().wishlistPlaceIds).toEqual([]);
  });
});
