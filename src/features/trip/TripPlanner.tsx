"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { budgetItems, itineraryStops } from "../../data/itinerary";
import type { ItineraryStop, Scenario } from "../../data/types";
import {
  applyScenario,
  buildBaiduMapUrl,
  buildBaiduPlaceUrl,
  summarizeBudget,
} from "./trip-logic";
import {
  defaultTripState,
  getTripStateSnapshot,
  subscribeTripState,
  updateTripState,
} from "./trip-storage";
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

const keepExistingRecords = () => undefined;

export function TripPlanner() {
  const budget = useMemo(() => summarizeBudget(budgetItems), []);
  const tripState = useSyncExternalStore(
    subscribeTripState,
    getTripStateSnapshot,
    () => defaultTripState,
  );
  const [selectedId, setSelectedId] = useState("tea");

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

  return (
    <main>
      <RouteView
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
      <TodoView completedIds={tripState.bookingIds} onToggle={toggleBooking} />
      <MyTripView
        scenario={tripState.scenario}
        completedStops={completedCount}
        totalStops={activeStops.length}
        completedBookings={completedBookings}
        budget={budget}
        onReset={keepExistingRecords}
      />

      <NextStopBar
        nextStop={nextStop}
        navigationUrl={buildBaiduMapUrl(nextOrigin, nextStop.placeName, nextStop.navigationMode)}
        onSelect={selectStop}
      />
    </main>
  );
}
