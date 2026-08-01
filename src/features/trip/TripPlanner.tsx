"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { budgetItems, itineraryStops } from "../../data/itinerary";
import type { ItineraryStop, MobileView, Scenario } from "../../data/types";
import {
  applyScenario,
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

const mobileViews: MobileView[] = ["route", "map", "todo", "me"];
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

function parseViewHash(hash: string): MobileView | null {
  const value = hash.replace(/^#/, "") as MobileView;
  return mobileViews.includes(value) ? value : null;
}

function updateActiveView(view: MobileView) {
  if (getTripStateSnapshot().activeView === view) return;
  updateTripState((current) => ({ ...current, activeView: view }));
}

export function TripPlanner() {
  const budget = useMemo(() => summarizeBudget(budgetItems), []);
  const tripState = useSyncExternalStore(
    subscribeTripState,
    getTripStateSnapshot,
    () => defaultTripState,
  );
  const [selectedId, setSelectedId] = useState("tea");
  const isMobile = useSyncExternalStore(
    subscribeMobileViewport,
    getMobileViewportSnapshot,
    () => false,
  );

  const activeStops = useMemo(
    () => applyScenario(itineraryStops, tripState.scenario),
    [tripState.scenario],
  );
  const fallbackSelectedStop =
    activeStops.find((stop) => !stop.id.startsWith("rail-")) ?? activeStops[0];
  const selectedStop =
    activeStops.find((stop) => stop.id === selectedId) ?? fallbackSelectedStop;
  const nextStop =
    activeStops.find(
      (stop) => !stop.id.startsWith("rail-") && !tripState.completedStopIds.includes(stop.id),
    ) ?? activeStops.at(-1)!;

  useEffect(() => {
    const selectedIsActive = activeStops.some((stop) => stop.id === selectedId);
    if (!selectedIsActive && fallbackSelectedStop && fallbackSelectedStop.id !== selectedId) {
      // The scenario-derived collection owns selection validity; synchronize only when it changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(fallbackSelectedStop.id);
    }
  }, [activeStops, fallbackSelectedStop, selectedId]);

  useEffect(() => {
    const initialView = parseViewHash(window.location.hash);
    if (initialView) {
      updateActiveView(initialView);
    } else {
      window.history.replaceState(null, "", `#${getTripStateSnapshot().activeView}`);
    }

    const syncViewFromHistory = () => {
      const historyView = parseViewHash(window.location.hash);
      if (historyView) updateActiveView(historyView);
    };

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
  const completedBookings = tripState.bookingIds.length;
  const selectedOrigin = getNavigationOrigin(activeStops, selectedStop.id);
  const nextOrigin = getNavigationOrigin(activeStops, nextStop.id);

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
    if (window.location.hash !== `#${view}`) {
      window.history.pushState(null, "", `#${view}`);
    }
  }, []);

  const resetLocalTrip = useCallback(() => {
    if (!window.confirm("确定清除当前设备上的模式、打卡、待办和最近功能吗？")) return;
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
          <span><strong>一日广州</strong><small>2026.08.20 · {tripState.scenario === "normal" ? "正常" : tripState.scenario === "rain" ? "下雨" : "高铁晚点"}</small></span>
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
        selectedNavigationUrl={buildBaiduMapUrl(
          selectedOrigin,
          selectedStop.placeName,
          selectedStop.navigationMode,
        )}
      />
      <MapView
        isActive={tripState.activeView === "map"}
        isMobile={isMobile}
        stops={activeStops}
        selectedStop={selectedStop}
        nextStop={nextStop}
        placeUrl={buildBaiduPlaceUrl(selectedStop.placeName)}
        nextNavigationUrl={buildBaiduMapUrl(
          nextOrigin,
          nextStop.placeName,
          nextStop.navigationMode,
        )}
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
        budget={budget}
        onReset={resetLocalTrip}
      />

      <NextStopBar
        nextStop={nextStop}
        navigationUrl={buildBaiduMapUrl(nextOrigin, nextStop.placeName, nextStop.navigationMode)}
        onSelect={selectStop}
      />
      <MobileAppShell activeView={tripState.activeView} onChange={setActiveView} />
    </main>
  );
}
