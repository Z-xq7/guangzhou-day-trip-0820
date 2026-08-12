import { discoveryPlaces } from "../../data/discovery";
import type { MobileView, Scenario, TripState } from "../../data/types";

export const STORAGE_KEY = "guangzhou-day-trip:v3";
export const V2_STORAGE_KEY = "guangzhou-day-trip:v2";
export const LEGACY_STORAGE_KEY = "guangzhou-day-trip:v1";
export const TRIP_STATE_CHANGE_EVENT = "guangzhou-day-trip:state-change";

export const defaultTripState: TripState = {
  version: 3,
  scenario: "normal",
  completedStopIds: [],
  bookingIds: [],
  wishlistPlaceIds: [],
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

interface V2TripState extends Omit<LegacyTripState, "version"> {
  version: 2;
  activeView: MobileView;
}

const knownDiscoveryIds = new Set(discoveryPlaces.map((place) => place.id));

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

function isMobileView(value: unknown): value is MobileView {
  return typeof value === "string" && ["route", "map", "todo", "me"].includes(value);
}

function isV3TripState(value: unknown): value is TripState {
  if (!hasTripProgress(value)) return false;
  const candidate = value as Partial<TripState>;
  return (
    candidate.version === 3 &&
    isMobileView(candidate.activeView) &&
    isStringArray(candidate.wishlistPlaceIds)
  );
}

function isV2TripState(value: unknown): value is V2TripState {
  if (!hasTripProgress(value)) return false;
  const candidate = value as Partial<V2TripState>;
  return candidate.version === 2 && isMobileView(candidate.activeView);
}

function isV1TripState(value: unknown): value is LegacyTripState {
  return hasTripProgress(value) && (value as Partial<LegacyTripState>).version === 1;
}

function normalizeWishlist(ids: string[]) {
  return [...new Set(ids.filter((id) => knownDiscoveryIds.has(id)))];
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

function safeRead(storage: StorageLike, key: string) {
  try {
    return parseStoredState(storage.getItem(key));
  } catch {
    return undefined;
  }
}

export function loadTripState(storage: StorageLike): TripState {
  const current = safeRead(storage, STORAGE_KEY);
  if (isV3TripState(current)) {
    return { ...current, wishlistPlaceIds: normalizeWishlist(current.wishlistPlaceIds) };
  }

  const version2 = safeRead(storage, V2_STORAGE_KEY);
  if (isV2TripState(version2)) {
    return { ...version2, version: 3, wishlistPlaceIds: [] };
  }

  const legacy = safeRead(storage, LEGACY_STORAGE_KEY);
  if (isV1TripState(legacy)) {
    return { ...legacy, version: 3, activeView: "route", wishlistPlaceIds: [] };
  }

  return defaultTripState;
}

export function clearTripState(storage: StorageLike) {
  let cleared = true;
  for (const key of [STORAGE_KEY, V2_STORAGE_KEY, LEGACY_STORAGE_KEY]) {
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
