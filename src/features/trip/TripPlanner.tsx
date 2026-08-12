"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { bookingItems, budgetItems, itineraryStops } from "../../data/itinerary";
import type { ItineraryStop, MobileView, Scenario } from "../../data/types";
import { DiscoveryView } from "../discovery/DiscoveryView";
import {
  defaultDiscoveryFilters,
  encodeDiscoveryHash,
  parseDiscoveryHash,
} from "../discovery/discovery-logic";
import type { DiscoveryFilters } from "../discovery/discovery-types";
import { clearWishlist, toggleWishlistPlace } from "../discovery/discovery-storage";
import {
  applyScenario,
  applyScenarioBudget,
  buildBaiduMapUrl,
  buildBaiduPlaceUrl,
  summarizeBudget,
} from "./trip-logic";
import {
  defaultTripState,
  getTripStateSnapshot,
  resetTripState,
  subscribeTripState,
  updateTripState,
} from "./trip-storage";
import { MobileAppShell } from "./MobileAppShell";
import { MapView, MyTripView, NextStopBar, RouteView, TodoView } from "./TripViews";

export { BookingChecklist, ScenarioSwitcher, TripTimeline } from "./TripViews";

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}

function getNavigationOrigin(stops: ItineraryStop[], destinationId: string) {
  const index = stops.findIndex((stop) => stop.id === destinationId);
  const previous = index > 0 ? stops[index - 1] : undefined;
  return !previous || previous.id === "rail-outbound" ? "广州南站" : previous.placeName;
}

const hashOwnership: Record<string, MobileView> = {
  route: "route",
  top: "route",
  "stop-detail": "route",
  map: "map",
  todo: "todo",
  checklist: "todo",
  me: "me",
  budget: "me",
};
const mobileViews = new Set<MobileView>(["route", "discover", "map", "todo", "me"]);
const mobileViewportQuery = "(max-width: 760px)";

function getMobileViewportSnapshot() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(mobileViewportQuery).matches;
}

function subscribeMobileViewport(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(mobileViewportQuery);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function parseOwnedHash(hash: string) {
  if (parseDiscoveryHash(hash)) {
    return { owner: "discover" as const, targetId: "discover" };
  }
  let targetId: string;
  try {
    targetId = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return null;
  }
  const owner = hashOwnership[targetId];
  return owner ? { owner, targetId } : null;
}

function getInitialDiscoveryState() {
  if (typeof window === "undefined") {
    return { placeId: null, filters: defaultDiscoveryFilters };
  }
  return parseDiscoveryHash(window.location.hash) ?? {
    placeId: null,
    filters: defaultDiscoveryFilters,
  };
}

function focusInternalHashTarget(targetId: string) {
  if (mobileViews.has(targetId as MobileView) || !getMobileViewportSnapshot()) return;
  const focusTarget = () => {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView?.({ block: "start" });
    target.focus({ preventScroll: true });
  };

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(focusTarget);
  } else {
    window.setTimeout(focusTarget, 0);
  }
}

function updateActiveView(view: MobileView) {
  if (getTripStateSnapshot().activeView === view) return;
  updateTripState((current) => ({ ...current, activeView: view }));
}

export function TripPlanner() {
  const tripState = useSyncExternalStore(
    subscribeTripState,
    getTripStateSnapshot,
    () => defaultTripState,
  );
  const [selectedId, setSelectedId] = useState("tea");
  const [discoveryState, setDiscoveryState] = useState(getInitialDiscoveryState);
  const isMobile = useSyncExternalStore(
    subscribeMobileViewport,
    getMobileViewportSnapshot,
    () => false,
  );

  const activeStops = useMemo(
    () => applyScenario(itineraryStops, tripState.scenario),
    [tripState.scenario],
  );
  const activeBudgetItems = useMemo(
    () => applyScenarioBudget(budgetItems, tripState.scenario),
    [tripState.scenario],
  );
  const budget = useMemo(() => summarizeBudget(activeBudgetItems), [activeBudgetItems]);
  const fallbackSelectedStop =
    activeStops.find((stop) => !stop.id.startsWith("rail-")) ?? activeStops[0];
  const selectedStop =
    activeStops.find((stop) => stop.id === selectedId) ?? fallbackSelectedStop;
  const progressNextStop =
    activeStops.find(
      (stop) => !stop.id.startsWith("rail-") && !tripState.completedStopIds.includes(stop.id),
    ) ?? activeStops.at(-1)!;
  const selectedStopIndex = activeStops.findIndex((stop) => stop.id === selectedStop.id);
  const selectedNextStop =
    selectedStopIndex >= 0 ? activeStops[selectedStopIndex + 1] : undefined;

  useEffect(() => {
    const selectedIsActive = activeStops.some((stop) => stop.id === selectedId);
    if (!selectedIsActive && fallbackSelectedStop && fallbackSelectedStop.id !== selectedId) {
      // The scenario-derived collection owns selection validity; synchronize only when it changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(fallbackSelectedStop.id);
    }
  }, [activeStops, fallbackSelectedStop, selectedId]);

  useEffect(() => {
    const syncViewFromHistory = () => {
      const parsedDiscovery = parseDiscoveryHash(window.location.hash);
      if (parsedDiscovery) {
        setDiscoveryState(parsedDiscovery);
        updateActiveView("discover");
        return;
      }
      const ownedHash = parseOwnedHash(window.location.hash);
      if (!ownedHash) return;
      updateActiveView(ownedHash.owner);
      focusInternalHashTarget(ownedHash.targetId);
    };

    const initialHash = parseOwnedHash(window.location.hash);
    if (initialHash) {
      updateActiveView(initialHash.owner);
      focusInternalHashTarget(initialHash.targetId);
    } else {
      window.history.replaceState(null, "", `#${getTripStateSnapshot().activeView}`);
    }

    window.addEventListener("popstate", syncViewFromHistory);
    window.addEventListener("hashchange", syncViewFromHistory);
    return () => {
      window.removeEventListener("popstate", syncViewFromHistory);
      window.removeEventListener("hashchange", syncViewFromHistory);
    };
  }, []);

  const completedCount = activeStops.filter((stop) =>
    tripState.completedStopIds.includes(stop.id),
  ).length;
  const knownBookingIds = new Set(bookingItems.map((item) => item.id));
  const completedBookings = new Set(
    tripState.bookingIds.filter((id) => knownBookingIds.has(id)),
  ).size;
  const selectedOrigin = getNavigationOrigin(activeStops, selectedStop.id);
  const progressNextOrigin = getNavigationOrigin(activeStops, progressNextStop.id);
  const selectedNextOrigin =
    selectedStop.id === "rail-outbound" ? "广州南站" : selectedStop.placeName;
  const selectedNavigationUrl =
    selectedStop.placeRegion && selectedStop.placeRegion !== "广州"
      ? buildBaiduPlaceUrl(selectedStop.placeName, selectedStop.placeRegion)
      : buildBaiduMapUrl(
          selectedOrigin,
          selectedStop.placeName,
          selectedStop.navigationMode,
        );

  const setScenario = useCallback((scenario: Scenario) => {
    updateTripState((current) => ({ ...current, scenario }));
  }, []);

  const selectStop = useCallback((id: string) => setSelectedId(id), []);

  const toggleStop = useCallback((id: string) => {
    updateTripState((current) => ({
      ...current,
      completedStopIds: toggleId(current.completedStopIds, id),
    }));
  }, []);

  const toggleBooking = useCallback((id: string) => {
    updateTripState((current) => ({
      ...current,
      bookingIds: toggleId(current.bookingIds, id),
    }));
  }, []);

  const setActiveView = useCallback((view: MobileView) => {
    updateActiveView(view);
    const nextHash = view === "discover"
      ? encodeDiscoveryHash(discoveryState)
      : `#${view}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", nextHash);
    }
  }, [discoveryState]);

  const setDiscoveryFilters = useCallback((filters: DiscoveryFilters) => {
    const nextState = { ...discoveryState, filters };
    setDiscoveryState(nextState);
    updateActiveView("discover");
    const nextHash = encodeDiscoveryHash(nextState);
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }, [discoveryState]);

  const setSelectedDiscoveryPlace = useCallback((placeId: string | null) => {
    const nextState = { ...discoveryState, placeId };
    setDiscoveryState(nextState);
    updateActiveView("discover");
    const nextHash = encodeDiscoveryHash(nextState);
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", nextHash);
    }
  }, [discoveryState]);

  const resetLocalTrip = useCallback(() => {
    if (!window.confirm("确定清除当前设备上的模式、打卡、待办、想去和最近功能吗？")) return;
    resetTripState();
    window.history.replaceState(null, "", "#route");
  }, []);

  return (
    <main>
      <header className="mobile-top-bar" aria-label="手机行程摘要">
        <a
          href="#route"
          onClick={(event) => {
            event.preventDefault();
            setActiveView("route");
          }}
        >
          <span className="mobile-top-bar-seal" aria-hidden="true">粤</span>
          <span>
            <strong>{tripState.activeView === "discover" ? "发现广州 · 30 个精选" : "一日广州"}</strong>
            <small>{tripState.activeView === "discover" ? "景点、美食与位置总览" : `2026.08.20 · ${tripState.scenario === "normal" ? "正常" : tripState.scenario === "rain" ? "下雨" : "高铁晚点"}`}</small>
          </span>
        </a>
      </header>
      <RouteView
        isActive={tripState.activeView === "route"}
        isMobile={isMobile}
        scenario={tripState.scenario}
        stops={activeStops}
        selectedStop={selectedStop}
        completedIds={tripState.completedStopIds}
        completedCount={completedCount}
        perPersonBudget={budget.perPerson}
        onScenarioChange={setScenario}
        onSelectStop={selectStop}
        onToggleStop={toggleStop}
        onNavigateView={setActiveView}
        selectedNavigationUrl={selectedNavigationUrl}
        progressNextStop={progressNextStop}
        progressNextNavigationUrl={buildBaiduMapUrl(
          progressNextOrigin,
          progressNextStop.placeName,
          progressNextStop.navigationMode,
        )}
      />
      <DiscoveryView
        isActive={tripState.activeView === "discover"}
        isMobile={isMobile}
        filters={discoveryState.filters}
        selectedPlaceId={discoveryState.placeId}
        wishlistIds={tripState.wishlistPlaceIds}
        onFiltersChange={setDiscoveryFilters}
        onSelectPlace={setSelectedDiscoveryPlace}
        onToggleWish={toggleWishlistPlace}
        onClearWishlist={clearWishlist}
      />
      <MapView
        isActive={tripState.activeView === "map"}
        isMobile={isMobile}
        stops={activeStops}
        selectedStop={selectedStop}
        nextStop={selectedNextStop}
        placeUrl={buildBaiduPlaceUrl(
          selectedStop.placeName,
          selectedStop.placeRegion ?? "广州",
        )}
        nextNavigationUrl={selectedNextStop ? buildBaiduMapUrl(
          selectedNextOrigin,
          selectedNextStop.placeName,
          selectedNextStop.navigationMode,
        ) : undefined}
        onSelectStop={selectStop}
      />
      <TodoView
        isActive={tripState.activeView === "todo"}
        isMobile={isMobile}
        completedIds={tripState.bookingIds}
        onToggle={toggleBooking}
      />
      <MyTripView
        isActive={tripState.activeView === "me"}
        isMobile={isMobile}
        scenario={tripState.scenario}
        completedStops={completedCount}
        totalStops={activeStops.length}
        completedBookings={completedBookings}
        wishlistCount={tripState.wishlistPlaceIds.length}
        budget={budget}
        budgetItems={activeBudgetItems}
        onNavigateView={setActiveView}
        onReset={resetLocalTrip}
      />

      {(!isMobile || tripState.activeView !== "route") && tripState.activeView !== "discover" ? (
        <NextStopBar
          nextStop={progressNextStop}
          navigationUrl={buildBaiduMapUrl(
            progressNextOrigin,
            progressNextStop.placeName,
            progressNextStop.navigationMode,
          )}
          onSelect={selectStop}
        />
      ) : null}
      <MobileAppShell activeView={tripState.activeView} onChange={setActiveView} />
    </main>
  );
}
