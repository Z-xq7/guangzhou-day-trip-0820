import { describe, expect, it } from "vitest";
import {
  applyScenario,
  buildBaiduMapUrl,
  buildBaiduPlaceUrl,
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
  it("moves a rainy day indoors with matching visible intervals and transfers", () => {
    const rainy = applyScenario(itineraryStops, "rain");

    expect(rainy.some((stop) => stop.id === "pantang")).toBe(false);
    expect(rainy.find((stop) => stop.id === "shamian")).toMatchObject({
      start: "14:25",
      end: "14:45",
      durationMinutes: 20,
    });
    expect(rainy.find((stop) => stop.id === "yongqing")).toMatchObject({
      start: "11:10",
      end: "12:50",
      durationMinutes: 100,
      navigationMode: "car",
      transport: "陈家祠 → 永庆坊 · 短程打车约 15 分",
    });
  });

  it("uses a coherent quick breakfast near Chen Clan after a train delay", () => {
    const delayed = applyScenario(itineraryStops, "delay");
    const breakfast = delayed.find((stop) => stop.id === "tea");

    expect(delayed.some((stop) => stop.id === "pantang")).toBe(false);
    expect(delayed.some((stop) => stop.id === "shamian")).toBe(false);
    expect(breakfast).toMatchObject({
      title: "陈家祠附近快捷点心",
      shortTitle: "快捷点心",
      start: "08:45",
      end: "09:20",
      durationMinutes: 35,
      placeName: "陈家祠地铁站附近点心店",
      navigationMode: "bus",
      transport: "广州南 → 陈家祠 · 地铁约 45 分",
      priceLabel: "¥30–50／人",
    });
    expect(breakfast?.summary).toContain("快捷");
    expect(breakfast?.comparisons).toEqual([
      {
        id: "quick-breakfast",
        badge: "晚点预案",
        title: "附近快捷点心",
        cost: "¥60–100／两人",
        time: "35 分钟",
        description: "少量点心快速补给，步行前往陈家祠。",
        recommended: true,
      },
    ]);
    expect(delayed.find((stop) => stop.id === "chen-clan")?.transport).toBe(
      "快捷点心店 → 陈家祠 · 步行约 10 分",
    );
    expect(delayed.find((stop) => stop.id === "yongqing")).toMatchObject({
      navigationMode: "car",
      transport: "陈家祠 → 永庆坊 · 短程打车约 15 分",
    });
    expect(delayed.find((stop) => stop.id === "beijing-road")?.transport).toBe(
      "宝华路 → 北京路 · 地铁约 25 分",
    );
  });

  it.each(["normal", "rain", "delay"] as const)(
    "keeps every %s entry internally consistent and preserves the booked cruise",
    (scenario) => {
      const stops = applyScenario(itineraryStops, scenario);
      const toMinutes = (time: string) => {
        const [hours, minutes] = time.split(":").map(Number);
        return hours * 60 + minutes;
      };

      for (const stop of stops) {
        expect(toMinutes(stop.end) - toMinutes(stop.start), stop.title).toBe(
          stop.durationMinutes,
        );
      }
      expect(validateSchedule(stops)).toEqual([]);
      expect(stops.find((stop) => stop.id === "cruise")).toMatchObject({
        start: "18:50",
        end: "20:30",
        durationMinutes: 100,
        reservation: "待官方开放 8 月 20 日班次",
      });

      const removedNames = scenario === "rain" ? ["泮塘"] : scenario === "delay" ? ["泮塘", "沙面"] : [];
      for (const stop of stops) {
        for (const removedName of removedNames) {
          expect(stop.transport, `${stop.title} 不应引用 ${removedName}`).not.toContain(removedName);
        }
      }
    },
  );

  it("uses each scenario's visible place and mode in its Baidu route", () => {
    const delayed = applyScenario(itineraryStops, "delay");
    const breakfast = delayed.find((stop) => stop.id === "tea")!;
    const url = new URL(
      buildBaiduMapUrl("广州南站", breakfast.placeName, breakfast.navigationMode),
    );

    expect(url.searchParams.get("destination")).toBe("name:广州 陈家祠地铁站附近点心店");
    expect(url.searchParams.get("mode")).toBe("transit");
  });
});

describe("budget summary", () => {
  it("calculates the independently checked Guangzhou-only range for one and two people", () => {
    expect(summarizeBudget(budgetItems)).toEqual({
      perPerson: { min: 348, max: 555 },
      couple: { min: 696, max: 1110 },
    });
  });

  it("changes only the delay breakfast budget for both one and two people", () => {
    expect(summarizeBudget(budgetItems, "delay")).toEqual({
      perPerson: { min: 308, max: 495 },
      couple: { min: 616, max: 990 },
    });
    expect(summarizeBudget(budgetItems)).toEqual({
      perPerson: { min: 348, max: 555 },
      couple: { min: 696, max: 1110 },
    });
  });
});

describe("Baidu Map URI", () => {
  it("builds a named transit route without requesting browser location", () => {
    const url = new URL(buildBaiduMapUrl("广州南站", "广州酒家文昌总店", "bus"));

    expect(url.origin + url.pathname).toBe("https://api.map.baidu.com/direction");
    expect(url.searchParams.get("origin")).toBe("name:广州 广州南站");
    expect(url.searchParams.get("destination")).toBe("name:广州 广州酒家文昌总店");
    expect(url.searchParams.get("mode")).toBe("transit");
    expect(url.searchParams.get("region")).toBe("广州");
    expect(url.searchParams.get("output")).toBe("html");
    expect(url.searchParams.has("location")).toBe(false);
  });

  it.each([
    ["walk", "walking"],
    ["bus", "transit"],
    ["car", "driving"],
  ] as const)("maps %s to Baidu mode %s", (mode, expected) => {
    const url = new URL(buildBaiduMapUrl("陈家祠", "沙面岛", mode));
    expect(url.searchParams.get("mode")).toBe(expected);
  });

  it("builds a Guangzhou-scoped place search", () => {
    const url = new URL(buildBaiduPlaceUrl("陈家祠"));
    expect(url.origin + url.pathname).toBe("https://api.map.baidu.com/place/search");
    expect(url.searchParams.get("query")).toBe("广州 陈家祠");
    expect(url.searchParams.get("region")).toBe("广州");
  });

  it("accepts an explicit Shenzhen region without changing the Guangzhou default", () => {
    const shenzhenUrl = new URL(buildBaiduPlaceUrl("深圳北站", "深圳"));
    const guangzhouUrl = new URL(buildBaiduPlaceUrl("陈家祠"));

    expect(shenzhenUrl.searchParams.get("query")).toBe("深圳 深圳北站");
    expect(shenzhenUrl.searchParams.get("region")).toBe("深圳");
    expect(guangzhouUrl.searchParams.get("query")).toBe("广州 陈家祠");
  });
});
