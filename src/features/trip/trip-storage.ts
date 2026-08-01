import type { Scenario, TripState } from "../../data/types";

export const STORAGE_KEY = "guangzhou-day-trip:v2";
export const LEGACY_STORAGE_KEY = "guangzhou-day-trip:v1";
export const TRIP_STATE_CHANGE_EVENT = "guangzhou-day-trip:state-change";

export const defaultTripState: TripState = {
  version: 2,
  scenario: "normal",
  completedStopIds: [],
  bookingIds: [],
  activeView: "route",
};

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface LegacyTripState {
  version: 1;
  scenario: Scenario;
  completedStopIds: string[];
  bookingIds: string[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function hasTripProgress(value: unknown): value is Omit<LegacyTripState, "version"> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LegacyTripState>;
  return (
    ["normal", "rain", "delay"].includes(candidate.scenario ?? "") &&
    isStringArray(candidate.completedStopIds) &&
    isStringArray(candidate.bookingIds)
  );
}

function isV2TripState(value: unknown): value is TripState {
  if (!hasTripProgress(value)) return false;
  const candidate = value as Partial<TripState>;
  return candidate.version === 2 && ["route", "map", "todo", "me"].includes(candidate.activeView ?? "");
}

function isV1TripState(value: unknown): value is LegacyTripState {
  return hasTripProgress(value) && (value as Partial<LegacyTripState>).version === 1;
}

export function saveTripState(storage: StorageLike, state: TripState) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function parseStoredState(raw: string | null): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function loadTripState(storage: StorageLike): TripState {
  try {
    const current = parseStoredState(storage.getItem(STORAGE_KEY));
    if (isV2TripState(current)) return current;

    const legacy = parseStoredState(storage.getItem(LEGACY_STORAGE_KEY));
    if (isV1TripState(legacy)) return { ...legacy, version: 2, activeView: "route" };

    return defaultTripState;
  } catch {
    return defaultTripState;
  }
}

export function clearTripState(storage: StorageLike) {
  let cleared = true;
  for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    try {
      storage.removeItem(key);
    } catch {
      cleared = false;
    }
  }
  return cleared;
}

let cachedRawState: string | null | undefined;
let cachedTripState = defaultTripState;
let memoryFallbackActive = false;

export function getTripStateSnapshot(): TripState {
  if (typeof window === "undefined") return defaultTripState;
  if (memoryFallbackActive) return cachedTripState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== cachedRawState) {
      cachedRawState = raw;
      cachedTripState = loadTripState(window.localStorage);
    }
  } catch {
    memoryFallbackActive = true;
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
  const serializedState = JSON.stringify(nextState);
  const persisted = saveTripState(window.localStorage, nextState);
  cachedTripState = nextState;
  cachedRawState = persisted ? serializedState : undefined;
  memoryFallbackActive = !persisted;
  window.dispatchEvent(new Event(TRIP_STATE_CHANGE_EVENT));
}

export function resetTripState() {
  const cleared = clearTripState(window.localStorage);
  cachedTripState = defaultTripState;
  cachedRawState = cleared ? null : undefined;
  memoryFallbackActive = !cleared;
  window.dispatchEvent(new Event(TRIP_STATE_CHANGE_EVENT));
}
