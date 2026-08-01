import type { BudgetItem, ItineraryStop, Scenario, ScheduleEntry } from "../../data/types";

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
  if (scenario === "normal") return stops.map((stop) => ({ ...stop }));

  if (scenario === "rain") {
    return stops
      .filter((stop) => stop.id !== "pantang")
      .map((stop) => {
        if (stop.id === "shamian") return { ...stop, durationMinutes: 20 };
        if (stop.id === "yongqing") return { ...stop, durationMinutes: 100 };
        return { ...stop };
      });
  }

  return stops
    .filter((stop) => stop.id !== "pantang" && stop.id !== "shamian")
    .map((stop) => ({ ...stop }));
}

export function summarizeBudget(items: BudgetItem[]) {
  const perPerson = items.reduce(
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

export function buildBaiduPlaceUrl(placeName: string) {
  const query = new URLSearchParams({
    query: `广州 ${placeName}`,
    region: "广州",
    output: "html",
    src: BAIDU_SOURCE,
  });
  return `https://api.map.baidu.com/place/search?${query.toString()}`;
}
