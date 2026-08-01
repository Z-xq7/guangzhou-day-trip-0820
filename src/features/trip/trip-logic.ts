import type { BudgetItem, ItineraryStop, Scenario, ScheduleEntry } from "../../data/types";
import { scenarioPlans } from "../../data/itinerary";

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function validateSchedule(stops: ScheduleEntry[]) {
  const conflicts: string[] = [];

  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1];
    const current = stops[index];
    if (timeToMinutes(current.start) < timeToMinutes(previous.end)) {
      conflicts.push(`${previous.title} 与 ${current.title} 时间重叠`);
    }
  }

  return conflicts;
}

export function applyScenario(stops: ItineraryStop[], scenario: Scenario) {
  const plan = scenarioPlans[scenario];
  const removedStopIds = new Set(plan.removedStopIds);

  return stops
    .filter((stop) => !removedStopIds.has(stop.id))
    .map((stop) => ({ ...stop, ...plan.stopOverrides[stop.id] }));
}

export function applyScenarioBudget(items: BudgetItem[], scenario: Scenario = "normal") {
  const overrides = scenarioPlans[scenario].budgetOverrides;
  return items.map((item) => ({ ...item, ...overrides[item.id] }));
}

export function summarizeBudget(items: BudgetItem[], scenario: Scenario = "normal") {
  const perPerson = applyScenarioBudget(items, scenario).reduce(
    (total, item) => ({ min: total.min + item.min, max: total.max + item.max }),
    { min: 0, max: 0 },
  );

  return {
    perPerson,
    couple: { min: perPerson.min * 2, max: perPerson.max * 2 },
  };
}

const baiduModes = {
  walk: "walking",
  bus: "transit",
  car: "driving",
} as const;

const BAIDU_SOURCE = "webapp.Z-xq7.guangzhou-day-trip";

export function buildBaiduMapUrl(
  originName: string,
  destinationName: string,
  mode: "walk" | "bus" | "car",
) {
  const query = new URLSearchParams({
    origin: `name:广州 ${originName}`,
    destination: `name:广州 ${destinationName}`,
    mode: baiduModes[mode],
    region: "广州",
    output: "html",
    src: BAIDU_SOURCE,
  });

  return `https://api.map.baidu.com/direction?${query.toString()}`;
}

export function buildBaiduPlaceUrl(placeName: string, region = "广州") {
  const query = new URLSearchParams({
    query: `${region} ${placeName}`,
    region,
    output: "html",
    src: BAIDU_SOURCE,
  });
  return `https://api.map.baidu.com/place/search?${query.toString()}`;
}
