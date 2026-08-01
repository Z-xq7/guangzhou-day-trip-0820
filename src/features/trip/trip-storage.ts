import type { TripState } from "../../data/types";

export const STORAGE_KEY = "guangzhou-day-trip:v1";
export const TRIP_STATE_CHANGE_EVENT = "guangzhou-day-trip:state-change";

export const defaultTripState: TripState = {
  version: 1,
  scenario: "normal",
  completedStopIds: [],
  bookingIds: [],
};

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isTripState(value: unknown): value is TripState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TripState>;
  return (
    candidate.version === 1 &&
    ["normal", "rain", "delay"].includes(candidate.scenario ?? "") &&
    Array.isArray(candidate.completedStopIds) &&
    Array.isArray(candidate.bookingIds)
  );
}

export function saveTripState(storage: StorageLike, state: TripState) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadTripState(storage: StorageLike): TripState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return defaultTripState;
    const parsed: unknown = JSON.parse(raw);
    return isTripState(parsed) ? parsed : defaultTripState;
  } catch {
    return defaultTripState;
  }
}

let cachedRawState: string | null | undefined;
let cachedTripState = defaultTripState;

export function getTripStateSnapshot(): TripState {
  if (typeof window === "undefined") return defaultTripState;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRawState) {
    cachedRawState = raw;
    cachedTripState = loadTripState(window.localStorage);
  }
  return cachedTripState;
}

export function subscribeTripState(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onChange);
  window.addEventListener(TRIP_STATE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(TRIP_STATE_CHANGE_EVENT, onChange);
  };
}

export function updateTripState(updater: (current: TripState) => TripState) {
  const nextState = updater(getTripStateSnapshot());
  saveTripState(window.localStorage, nextState);
  cachedRawState = undefined;
  window.dispatchEvent(new Event(TRIP_STATE_CHANGE_EVENT));
}
