import { describe, expect, it } from "vitest";
import {
  applyScenario,
  buildAmapNavigationUrl,
  summarizeBudget,
  validateSchedule,
} from "../src/features/trip/trip-logic";
import { budgetItems, itineraryStops } from "../src/data/itinerary";

describe("trip schedule", () => {
  it("accepts the planned route because every stop starts after the prior stop ends", () => {
    expect(validateSchedule(itineraryStops)).toEqual([]);
  });

  it("reports both stop names when two itinerary entries overlap", () => {
    const conflicts = validateSchedule([
      { id: "tea", title: "早茶", start: "08:20", end: "09:25" },
      { id: "temple", title: "陈家祠", start: "09:10", end: "10:10" },
    ]);

    expect(conflicts).toEqual(["早茶 与 陈家祠 时间重叠"]);
  });
});

describe("scenario changes", () => {
  it("moves a rainy day indoors while preserving the reserved night cruise", () => {
    const rainy = applyScenario(itineraryStops, "rain");

    expect(rainy.some((stop) => stop.id === "pantang")).toBe(false);
    expect(rainy.find((stop) => stop.id === "shamian")?.durationMinutes).toBe(20);
    expect(rainy.find((stop) => stop.id === "yongqing")?.durationMinutes).toBe(100);
    expect(rainy.some((stop) => stop.id === "cruise")).toBe(true);
  });

  it("removes the lowest-priority outdoor stops after a train delay", () => {
    const delayed = applyScenario(itineraryStops, "delay");

    expect(delayed.some((stop) => stop.id === "pantang")).toBe(false);
    expect(delayed.some((stop) => stop.id === "shamian")).toBe(false);
    expect(delayed.some((stop) => stop.id === "chen-clan")).toBe(true);
    expect(delayed.some((stop) => stop.id === "cruise")).toBe(true);
  });
});

describe("budget summary", () => {
  it("calculates the independently checked Guangzhou-only range for one and two people", () => {
    expect(summarizeBudget(budgetItems)).toEqual({
      perPerson: { min: 348, max: 555 },
      couple: { min: 696, max: 1110 },
    });
  });
});

describe("Amap navigation", () => {
  it("encodes a place-name route without requesting location in the website", () => {
    const url = new URL(buildAmapNavigationUrl("陈家祠", "bus"));

    expect(url.origin + url.pathname).toBe("https://uri.amap.com/navigation");
    expect(url.searchParams.get("from")).toBe(",,");
    expect(url.searchParams.get("to")).toBe(",,陈家祠");
    expect(url.searchParams.get("mode")).toBe("bus");
    expect(url.searchParams.get("callnative")).toBe("1");
  });
});
