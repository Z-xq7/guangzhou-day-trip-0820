// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bookingItems,
  budgetItems,
  itineraryStops,
  sources,
} from "../src/data/itinerary";
import {
  BookingChecklist,
  ScenarioSwitcher,
  TripPlanner,
  TripTimeline,
} from "../src/features/trip/TripPlanner";
import {
  applyScenario,
  buildBaiduMapUrl,
  buildBaiduPlaceUrl,
  summarizeBudget,
} from "../src/features/trip/trip-logic";
import { RouteDiagram } from "../src/features/trip/RouteDiagram";
import { StopPhoto } from "../src/features/trip/StopPhoto";
import { MobileAppShell } from "../src/features/trip/MobileAppShell";
import {
  MapView,
  MyTripView,
  RouteView,
  TodoView,
} from "../src/features/trip/TripViews";
import {
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  TRIP_STATE_CHANGE_EVENT,
  V2_STORAGE_KEY,
} from "../src/features/trip/trip-storage";

const initialClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const initialMatchMediaDescriptor = Object.getOwnPropertyDescriptor(window, "matchMedia");
const initialScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);

function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const addEventListener = vi.fn(
    (_type: "change", listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
  );
  const removeEventListener = vi.fn(
    (_type: "change", listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
  );
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: "(max-width: 760px)",
    onchange: null,
    addEventListener,
    removeEventListener,
  } as unknown as MediaQueryList;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => mediaQueryList),
  });

  return {
    addEventListener,
    removeEventListener,
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      const event = { matches, media: mediaQueryList.media } as MediaQueryListEvent;
      act(() => listeners.forEach((listener) => listener(event)));
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  if (initialClipboardDescriptor) {
    Object.defineProperty(navigator, "clipboard", initialClipboardDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
  if (initialMatchMediaDescriptor) {
    Object.defineProperty(window, "matchMedia", initialMatchMediaDescriptor);
  } else {
    Reflect.deleteProperty(window, "matchMedia");
  }
  if (initialScrollIntoViewDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      initialScrollIntoViewDescriptor,
    );
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  }
});

const viewStops = applyScenario(itineraryStops, "normal");
const viewSelectedStop = viewStops.find((stop) => stop.id === "chen-clan")!;
const viewNextStop = viewStops.find((stop) => stop.id === "pantang")!;
const viewBudget = summarizeBudget(budgetItems);

const routeProps = {
  scenario: "normal" as const,
  stops: viewStops,
  selectedStop: viewSelectedStop,
  completedIds: ["tea"],
  completedCount: 1,
  perPersonBudget: viewBudget.perPerson,
  onScenarioChange: vi.fn(),
  onSelectStop: vi.fn(),
  onToggleStop: vi.fn(),
  selectedNavigationUrl: buildBaiduMapUrl(
    itineraryStops[1].placeName,
    viewSelectedStop.placeName,
    viewSelectedStop.navigationMode,
  ),
};

const mapProps = {
  stops: viewStops,
  selectedStop: viewSelectedStop,
  nextStop: viewNextStop,
  placeUrl: buildBaiduPlaceUrl(viewSelectedStop.placeName),
  nextNavigationUrl: buildBaiduMapUrl(
    viewSelectedStop.placeName,
    viewNextStop.placeName,
    viewNextStop.navigationMode,
  ),
  onSelectStop: vi.fn(),
};

const todoProps = {
  completedIds: [bookingItems[0].id],
  onToggle: vi.fn(),
};

const myTripProps = {
  scenario: "normal" as const,
  completedStops: 1,
  totalStops: viewStops.length,
  completedBookings: 1,
  budget: viewBudget,
  wishlistCount: 2,
  onReset: vi.fn(),
};

describe("TripViews", () => {
  it("exposes one labeled region for each app function", () => {
    render(
      <div>
        <RouteView {...routeProps} />
        <MapView {...mapProps} />
        <TodoView {...todoProps} />
        <MyTripView {...myTripProps} />
      </div>,
    );

    expect(screen.getByRole("region", { name: "路线规划" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "地图与导航" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "行前待办" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "我的行程" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "地图与导航" })).toHaveTextContent(
      "游览顺序示意",
    );
    expect(screen.getByText("不登录、不定位、不上传数据")).toBeInTheDocument();
    expect(screen.getByText(sources[0].title)).toBeInTheDocument();

    const headerNav = within(screen.getByRole("navigation", { name: "页面导航" }));
    expect(headerNav.getByRole("link", { name: "路线" })).toHaveAttribute("href", "#route");
    expect(headerNav.getByRole("link", { name: "发现" })).toHaveAttribute("href", "#discover");
    expect(headerNav.getByRole("link", { name: "地图" })).toHaveAttribute("href", "#map");
    expect(headerNav.getByRole("link", { name: "预约" })).toHaveAttribute("href", "#todo");
    expect(headerNav.getByRole("link", { name: "预算" })).toHaveAttribute("href", "#me");
  });

  it("opens both Baidu place search and next-leg navigation from the map view", () => {
    render(<MapView {...mapProps} />);

    expect(screen.getByRole("link", { name: /在百度地图查看地点/ })).toHaveAttribute(
      "href",
      expect.stringContaining("api.map.baidu.com/place/search"),
    );
    expect(screen.getByRole("link", { name: /百度地图去下一站/ })).toHaveAttribute(
      "href",
      expect.stringContaining("api.map.baidu.com/direction"),
    );
  });

  it("derives exactly nine safe centralized photo credits from the itinerary", () => {
    render(<MyTripView {...myTripProps} />);
    const creditRegion = screen.getByRole("region", { name: "图片来源" });
    const creditLinks = within(creditRegion).getAllByRole("link");
    const photoStops = itineraryStops.filter((stop) => stop.photo);

    expect(creditLinks).toHaveLength(18);
    photoStops.forEach((stop) => {
      const creditCard = within(creditRegion).getByRole("article", { name: stop.title });
      const sourceLink = within(creditCard).getByRole("link", {
        name: `${stop.title} 原图来源`,
      });
      expect(sourceLink).toHaveAttribute("href", stop.photo?.sourceUrl);
      expect(sourceLink).toHaveAttribute("target", "_blank");
      expect(sourceLink).toHaveAttribute("rel", "noreferrer");

      const licenseLink = within(creditCard).getByRole("link", {
        name: `${stop.title} 许可：${stop.photo?.license}`,
      });
      expect(licenseLink).toHaveAttribute("href", stop.photo?.licenseUrl);
      expect(licenseLink).toHaveAttribute("target", "_blank");
      expect(licenseLink).toHaveAttribute("rel", "noreferrer");
      expect(within(creditCard).getByText(stop.photo!.modifications)).toBeVisible();
    });
  });

  it("summarizes discovery candidates and opens the discovery view", () => {
    const onNavigateView = vi.fn();
    render(<MyTripView {...myTripProps} onNavigateView={onNavigateView} />);

    expect(screen.getByLabelText("我的行程进度")).toHaveTextContent("想去地点");
    expect(screen.getByLabelText("我的行程进度")).toHaveTextContent("2 个");
    fireEvent.click(screen.getByRole("button", { name: "查看 2 个想去地点" }));
    expect(onNavigateView).toHaveBeenCalledWith("discover");
  });

  it("confirms a copied place and uses the exact Guangzhou search text", async () => {
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<MapView {...mapProps} />);

    fireEvent.click(screen.getByRole("button", { name: "复制地点" }));

    expect(writeText).toHaveBeenCalledWith("广州 陈家祠");
    expect(await screen.findByText("已复制地点")).toBeInTheDocument();
  });

  it("shows selectable place text when clipboard permission fails", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    render(<MapView {...mapProps} />);

    fireEvent.click(screen.getByRole("button", { name: "复制地点" }));

    expect(await screen.findByLabelText("手动复制地点")).toHaveTextContent("广州 陈家祠");
  });

  it("shows manual copy text when the Clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    render(<MapView {...mapProps} />);

    fireEvent.click(screen.getByRole("button", { name: "复制地点" }));

    expect(await screen.findByLabelText("手动复制地点")).toHaveTextContent("广州 陈家祠");
  });

  it("clears copied feedback when the selected place changes", async () => {
    const { rerender } = render(<MapView {...mapProps} />);
    fireEvent.click(screen.getByRole("button", { name: "复制地点" }));
    expect(await screen.findByText("已复制地点")).toBeInTheDocument();

    rerender(<MapView {...mapProps} selectedStop={viewNextStop} />);

    expect(screen.queryByText("已复制地点")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制地点" })).toBeInTheDocument();
  });

  it("clears manual-copy feedback when the selected place changes", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    const { rerender } = render(<MapView {...mapProps} />);
    fireEvent.click(screen.getByRole("button", { name: "复制地点" }));
    expect(await screen.findByLabelText("手动复制地点")).toHaveTextContent("广州 陈家祠");

    rerender(<MapView {...mapProps} selectedStop={viewNextStop} />);

    expect(screen.queryByLabelText("手动复制地点")).not.toBeInTheDocument();
  });

  it("does not apply a pending copy result to a newly selected place", async () => {
    let resolveCopy: (() => void) | undefined;
    const pendingCopy = new Promise<void>((resolve) => {
      resolveCopy = resolve;
    });
    vi.spyOn(navigator.clipboard, "writeText").mockReturnValue(pendingCopy);
    const { rerender } = render(<MapView {...mapProps} />);
    fireEvent.click(screen.getByRole("button", { name: "复制地点" }));

    rerender(<MapView {...mapProps} selectedStop={viewNextStop} />);
    await act(async () => {
      resolveCopy?.();
      await pendingCopy;
    });

    expect(screen.queryByText("已复制地点")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制地点" })).toBeInTheDocument();
  });

  it("keeps the latest copied feedback when an older request resolves last", async () => {
    let resolveFirstCopy: (() => void) | undefined;
    const firstCopy = new Promise<void>((resolve) => {
      resolveFirstCopy = resolve;
    });
    vi.spyOn(navigator.clipboard, "writeText")
      .mockReturnValueOnce(firstCopy)
      .mockResolvedValueOnce(undefined);
    const { rerender } = render(<MapView {...mapProps} />);
    fireEvent.click(screen.getByRole("button", { name: "复制地点" }));

    rerender(<MapView {...mapProps} selectedStop={viewNextStop} />);
    fireEvent.click(screen.getByRole("button", { name: "复制地点" }));
    expect(await screen.findByText("已复制地点")).toBeInTheDocument();

    await act(async () => {
      resolveFirstCopy?.();
      await firstCopy;
    });

    expect(screen.getByText("已复制地点")).toBeInTheDocument();
  });

  it("keeps the latest copied feedback when an older request rejects last", async () => {
    let rejectFirstCopy: ((error: Error) => void) | undefined;
    const firstCopy = new Promise<void>((_resolve, reject) => {
      rejectFirstCopy = reject;
    });
    vi.spyOn(navigator.clipboard, "writeText")
      .mockReturnValueOnce(firstCopy)
      .mockResolvedValueOnce(undefined);
    const { rerender } = render(<MapView {...mapProps} />);
    fireEvent.click(screen.getByRole("button", { name: "复制地点" }));

    rerender(<MapView {...mapProps} selectedStop={viewNextStop} />);
    fireEvent.click(screen.getByRole("button", { name: "复制地点" }));
    expect(await screen.findByText("已复制地点")).toBeInTheDocument();

    await act(async () => {
      rejectFirstCopy?.(new Error("stale denied"));
      await firstCopy.catch(() => undefined);
    });

    expect(screen.getByText("已复制地点")).toBeInTheDocument();
  });
});

describe("MobileAppShell", () => {
  it("switches all five functions and exposes the active page", () => {
    const onChange = vi.fn();
    render(<MobileAppShell activeView="route" onChange={onChange} />);

    const mobileNav = within(screen.getByRole("navigation", { name: "手机功能导航" }));
    expect(mobileNav.getAllByRole("link")).toHaveLength(5);
    expect(mobileNav.getByRole("link", { name: "路线" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(mobileNav.getByRole("link", { name: "发现" })).toHaveAttribute(
      "href",
      "#discover",
    );
    fireEvent.click(mobileNav.getByRole("link", { name: "发现" }));
    expect(onChange).toHaveBeenCalledWith("discover");
    fireEvent.click(mobileNav.getByRole("link", { name: "地图" }));
    expect(onChange).toHaveBeenCalledWith("map");
    fireEvent.click(mobileNav.getByRole("link", { name: "待办" }));
    expect(onChange).toHaveBeenCalledWith("todo");
    fireEvent.click(mobileNav.getByRole("link", { name: "我的" }));
    expect(onChange).toHaveBeenCalledWith("me");
  });
});

describe("TripPlanner", () => {
  it("restores a direct discovery detail with its filters and mobile owner", () => {
    installMatchMedia(true);
    window.history.replaceState(
      null,
      "",
      "#discover/chen-clan-academy?q=%E5%B2%AD%E5%8D%97",
    );

    render(<TripPlanner />);

    const discovery = screen.getByRole("region", { name: "发现广州" });
    expect(discovery).toHaveClass("is-active");
    expect(within(discovery).getByRole("searchbox", { name: "搜索地点、美食或主题" }))
      .toHaveValue("岭南");
    expect(within(discovery).getByRole("button", { name: "收起陈家祠详情" })).toBeVisible();
    const mobileNav = within(screen.getByRole("navigation", { name: "手机功能导航" }));
    expect(mobileNav.getByRole("link", { name: "发现" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("banner", { name: "手机行程摘要" }))
      .toHaveTextContent("发现广州 · 30 个精选");
    expect(screen.queryByLabelText("下一站快捷操作")).not.toBeInTheDocument();
  });

  it("owns discovery selection history and restores it on popstate", () => {
    installMatchMedia(true);
    window.history.replaceState(null, "", "#discover/chen-clan-academy");
    render(<TripPlanner />);

    fireEvent.click(screen.getByRole("button", { name: "查看沙面详情" }));
    expect(window.location.hash).toBe("#discover/shamian");
    expect(screen.getByRole("button", { name: "收起沙面详情" })).toBeVisible();

    window.history.pushState(null, "", "#discover/chen-clan-academy");
    fireEvent.popState(window);
    expect(screen.getByRole("button", { name: "收起陈家祠详情" })).toBeVisible();
  });

  it("restores discovery state after an unmount and refresh-equivalent remount", () => {
    installMatchMedia(true);
    window.history.replaceState(null, "", "#discover/nanxin-dessert?q=%E5%8F%8C%E7%9A%AE%E5%A5%B6");
    const first = render(<TripPlanner />);
    first.unmount();

    render(<TripPlanner />);

    expect(screen.getByRole("searchbox", { name: "搜索地点、美食或主题" }))
      .toHaveValue("双皮奶");
    expect(screen.getByRole("button", { name: "收起南信牛奶甜品专家详情" })).toBeVisible();
  });

  it("switches to the rain plan, updates the route, and saves the choice locally", () => {
    window.localStorage.clear();
    render(<TripPlanner />);

    expect(screen.getByRole("heading", { name: /趁一日，饮啖茶/ })).toBeInTheDocument();
    expect(screen.getByText("¥348–555")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "下雨" }));

    const routeView = screen.getByRole("region", { name: "路线规划" });
    expect(within(routeView).queryByRole("button", { name: /泮塘五约/ }))
      .not.toBeInTheDocument();
    expect(screen.getByText(/雨天把时间留在室内/)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").scenario).toBe(
      "rain",
    );
  });

  it("opens Baidu navigation from the preceding active stop", () => {
    window.localStorage.clear();
    render(<TripPlanner />);

    const timeline = screen.getByRole("region", { name: "一日时间轴" });
    fireEvent.click(within(timeline).getByRole("button", { name: /09:40.*陈家祠/ }));

    const navigationUrl = new URL(
      screen.getByRole("link", { name: /在百度地图打开 岭南雕花/ }).getAttribute("href") ?? "",
    );
    expect(navigationUrl.searchParams.get("origin")).toBe("name:广州 广州酒家文昌总店");
    expect(navigationUrl.searchParams.get("destination")).toBe("name:广州 陈家祠");
  });

  it("keeps the fixed progress stop separate from the selected station successor", () => {
    render(<TripPlanner />);

    const mapView = screen.getByRole("region", { name: "地图与导航" });
    const nextBar = screen.getByLabelText("下一站快捷操作");
    expect(nextBar).toHaveTextContent("广州酒家文昌总店早茶");
    expect(within(mapView).getByText("陈家祠", { selector: "strong" })).toBeInTheDocument();

    const initialUrl = new URL(
      within(mapView).getByRole("link", { name: /百度地图去下一站/ }).getAttribute("href") ?? "",
    );
    expect(initialUrl.searchParams.get("origin")).toBe("name:广州 广州酒家文昌总店");
    expect(initialUrl.searchParams.get("destination")).toBe("name:广州 陈家祠");

    const diagram = within(mapView).getByRole("region", { name: "广州一日游游览顺序示意" });
    fireEvent.click(within(diagram).getByRole("button", { name: /09:40.*陈家祠/ }));
    expect(within(mapView).getByText("泮塘五约 · 荔枝湾", { selector: "strong" })).toBeInTheDocument();

    const chenUrl = new URL(
      within(mapView).getByRole("link", { name: /百度地图去下一站/ }).getAttribute("href") ?? "",
    );
    expect(chenUrl.searchParams.get("origin")).toBe("name:广州 陈家祠");
    expect(chenUrl.searchParams.get("destination")).toBe(
      "name:广州 泮塘五约历史文化街区",
    );
  });

  it("recomputes the selected successor after scenario deletion and completes at the final station", () => {
    render(<TripPlanner />);
    const mapView = screen.getByRole("region", { name: "地图与导航" });
    const diagram = within(mapView).getByRole("region", { name: "广州一日游游览顺序示意" });

    fireEvent.click(within(diagram).getByRole("button", { name: /09:40.*陈家祠/ }));
    fireEvent.click(screen.getByRole("tab", { name: "下雨" }));
    expect(within(mapView).getByText("永庆坊 · 粤剧艺术博物馆", { selector: "strong" }))
      .toBeInTheDocument();
    expect(within(mapView).queryByText(/泮塘/, { selector: "strong" })).not.toBeInTheDocument();

    const rainyUrl = new URL(
      within(mapView).getByRole("link", { name: /百度地图去下一站/ }).getAttribute("href") ?? "",
    );
    expect(rainyUrl.searchParams.get("origin")).toBe("name:广州 陈家祠");
    expect(rainyUrl.searchParams.get("destination")).toBe("name:广州 粤剧艺术博物馆");
    expect(rainyUrl.searchParams.get("mode")).toBe("driving");

    const rainyDiagram = within(mapView).getByRole("region", {
      name: "广州一日游游览顺序示意",
    });
    fireEvent.click(within(rainyDiagram).getByRole("button", { name: /20:30.*广州南.*深圳北/ }));
    expect(within(mapView).getByText("路线已完成")).toBeInTheDocument();
    expect(within(mapView).queryByRole("link", { name: /百度地图去下一站/ }))
      .not.toBeInTheDocument();
  });

  it("opens outbound rail as a Shenzhen place instead of a cross-city bus route", () => {
    render(<TripPlanner />);
    const timeline = screen.getByRole("region", { name: "一日时间轴" });
    fireEvent.click(within(timeline).getByRole("button", { name: /06:35.*深圳北.*广州南/ }));

    const routeView = screen.getByRole("region", { name: "路线规划" });
    const railAction = within(routeView).getByRole("link", {
      name: /在百度地图.*早班高铁/,
    });
    const url = new URL(railAction.getAttribute("href") ?? "");
    expect(url.origin + url.pathname).toBe("https://api.map.baidu.com/place/search");
    expect(url.searchParams.get("query")).toBe("深圳 深圳北站");
    expect(url.searchParams.get("region")).toBe("深圳");
    expect(url.searchParams.has("mode")).toBe(false);
  });

  it("renders the delay breakfast copy, budget, transfer, and Baidu target from one override", () => {
    render(<TripPlanner />);
    fireEvent.click(screen.getByRole("tab", { name: "高铁晚点" }));

    const routeView = screen.getByRole("region", { name: "路线规划" });
    const stopDetail = within(routeView).getByRole("article");
    expect(within(routeView).getByRole("heading", { name: "陈家祠附近快捷点心" }))
      .toBeInTheDocument();
    expect(within(stopDetail).getByText("08:45–09:20 · 35 分钟")).toBeInTheDocument();
    expect(within(stopDetail).getByText("广州南 → 陈家祠 · 地铁约 45 分"))
      .toBeInTheDocument();
    expect(within(stopDetail).getByText("¥30–50／人")).toBeInTheDocument();
    expect(within(routeView).getByLabelText("行程关键数据")).toHaveTextContent("¥308–495");
    expect(screen.getByText("双人共 ¥616–990")).toBeInTheDocument();

    const actionUrl = new URL(
      within(routeView).getByRole("link", { name: /在百度地图打开 快捷点心/ })
        .getAttribute("href") ?? "",
    );
    expect(actionUrl.searchParams.get("destination")).toBe(
      "name:广州 陈家祠地铁站附近点心店",
    );
    expect(actionUrl.searchParams.get("mode")).toBe("transit");
  });

  it("keeps a valid non-rail selection after a scenario removes the selected stop", () => {
    window.localStorage.clear();
    render(<TripPlanner />);

    const timeline = screen.getByRole("region", { name: "一日时间轴" });
    fireEvent.click(within(timeline).getByRole("button", { name: /11:05.*泮塘/ }));
    expect(screen.getByRole("link", { name: /在百度地图打开 水乡慢行/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "下雨" }));
    expect(screen.getByRole("link", { name: /在百度地图打开 一盅两件/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "正常" }));
    expect(screen.getByRole("link", { name: /在百度地图打开 一盅两件/ })).toBeInTheDocument();
  });

  it("persists mobile view and responds to browser history without duplicate updates", () => {
    window.history.replaceState(null, "", "#route");
    const pushState = vi.spyOn(window.history, "pushState");
    const dispatchEvent = vi.spyOn(window, "dispatchEvent");
    const stateChanges = vi.fn();
    window.addEventListener(TRIP_STATE_CHANGE_EVENT, stateChanges);

    try {
      render(<TripPlanner />);

      const mobileNav = within(screen.getByRole("navigation", { name: "手机功能导航" }));
      fireEvent.click(mobileNav.getByRole("link", { name: "地图" }));
      expect(window.location.hash).toBe("#map");
      expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").activeView).toBe("map");
      expect(pushState).toHaveBeenCalledTimes(1);
      expect(stateChanges).toHaveBeenCalledTimes(1);
      expect(dispatchEvent.mock.calls.some(([event]) =>
        ["popstate", "hashchange"].includes(event.type))).toBe(false);

      window.history.pushState(null, "", "#todo");
      fireEvent.popState(window);
      expect(mobileNav.getByRole("link", { name: "待办" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").activeView).toBe("todo");
      expect(stateChanges).toHaveBeenCalledTimes(2);

      window.history.pushState(null, "", "#me");
      fireEvent(window, new Event("hashchange"));
      expect(mobileNav.getByRole("link", { name: "我的" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").activeView).toBe("me");
      expect(stateChanges).toHaveBeenCalledTimes(3);

      fireEvent(window, new Event("hashchange"));
      expect(stateChanges).toHaveBeenCalledTimes(3);
      expect(pushState).toHaveBeenCalledTimes(3);
    } finally {
      window.removeEventListener(TRIP_STATE_CHANGE_EVENT, stateChanges);
    }
  });

  it("lets a valid initial hash override the persisted mobile view", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 3,
      scenario: "normal",
      completedStopIds: [],
      bookingIds: [],
      activeView: "map",
      wishlistPlaceIds: [],
    }));
    window.history.replaceState(null, "", "#todo");

    render(<TripPlanner />);

    const mobileNav = within(screen.getByRole("navigation", { name: "手机功能导航" }));
    expect(mobileNav.getByRole("link", { name: "待办" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").activeView).toBe("todo");
  });

  it.each([
    ["#stop-detail", "route", "路线"],
    ["#checklist", "todo", "待办"],
  ] as const)(
    "keeps %s on direct mobile load, selects its owner, scrolls, and focuses it",
    async (hash, owner, tabLabel) => {
      installMatchMedia(true);
      const scrollIntoView = vi.fn();
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: scrollIntoView,
      });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 3,
        scenario: "normal",
        completedStopIds: [],
        bookingIds: [],
        activeView: owner === "route" ? "map" : "me",
        wishlistPlaceIds: [],
      }));
      window.history.replaceState(null, "", hash);

      render(<TripPlanner />);

      const target = document.getElementById(hash.slice(1));
      const mobileNav = within(screen.getByRole("navigation", { name: "手机功能导航" }));
      await waitFor(() => {
        expect(window.location.hash).toBe(hash);
        expect(document.getElementById(owner)).toHaveClass("is-active");
        expect(mobileNav.getByRole("link", { name: tabLabel })).toHaveAttribute(
          "aria-current",
          "page",
        );
        expect(document.activeElement).toBe(target);
      });
      expect(target).toHaveAttribute("tabindex", "-1");
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
      expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").activeView).toBe(owner);
    },
  );

  it("restores the route owner when Back returns through an internal stop-detail hash", async () => {
    installMatchMedia(true);
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    window.history.replaceState(null, "", "#route");
    render(<TripPlanner />);

    act(() => {
      window.location.hash = "stop-detail";
    });
    await waitFor(() => expect(window.location.hash).toBe("#stop-detail"));

    const mobileNav = within(screen.getByRole("navigation", { name: "手机功能导航" }));
    fireEvent.click(mobileNav.getByRole("link", { name: "地图" }));
    expect(window.location.hash).toBe("#map");
    expect(document.getElementById("map")).toHaveClass("is-active");

    act(() => window.history.back());
    await waitFor(() => {
      expect(window.location.hash).toBe("#stop-detail");
      expect(document.getElementById("route")).toHaveClass("is-active");
      expect(mobileNav.getByRole("link", { name: "路线" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
  });

  it.each([
    ["missing", ""],
    ["invalid", "#unknown"],
  ])("replaces a %s initial hash with the persisted mobile view", (_kind, hash) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 3,
      scenario: "normal",
      completedStopIds: [],
      bookingIds: [],
      activeView: "map",
      wishlistPlaceIds: [],
    }));
    window.history.replaceState(null, "", hash);
    const replaceState = vi.spyOn(window.history, "replaceState");

    render(<TripPlanner />);

    expect(window.location.hash).toBe("#map");
    expect(replaceState).toHaveBeenCalledWith(null, "", "#map");
  });

  it("keeps all app views in the desktop accessibility tree", () => {
    const media = installMatchMedia(false);
    window.history.replaceState(null, "", "#map");
    render(<TripPlanner />);

    expect(document.getElementById("map")).toHaveClass("is-active");
    for (const id of ["route", "discover", "map", "todo", "me"]) {
      expect(document.getElementById(id)).not.toHaveAttribute("aria-hidden");
    }
    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 760px)");
    expect(media.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("hides inactive app views only on mobile and cleans up its media listener", () => {
    const media = installMatchMedia(true);
    window.history.replaceState(null, "", "#map");
    const { unmount } = render(<TripPlanner />);

    expect(document.getElementById("map")).not.toHaveAttribute("aria-hidden");
    for (const id of ["route", "discover", "todo", "me"]) {
      expect(document.getElementById(id)).toHaveAttribute("aria-hidden", "true");
    }

    media.setMatches(false);
    for (const id of ["route", "discover", "map", "todo", "me"]) {
      expect(document.getElementById(id)).not.toHaveAttribute("aria-hidden");
    }

    const subscribedListener = media.addEventListener.mock.calls[0]?.[1];
    unmount();
    expect(media.removeEventListener).toHaveBeenCalledWith("change", subscribedListener);
  });

  it("exposes a compact mobile trip summary with the current scenario", () => {
    installMatchMedia(true);
    render(<TripPlanner />);

    const summary = screen.getByRole("banner", { name: "手机行程摘要" });
    expect(summary).toHaveTextContent("一日广州");
    expect(summary).toHaveTextContent("2026.08.20");
    expect(summary).toHaveTextContent("正常");

    fireEvent.click(screen.getByRole("tab", { name: "下雨" }));
    expect(summary).toHaveTextContent("下雨");
  });

  it("replaces the mobile marketing hero with one operational first-screen panel", () => {
    installMatchMedia(true);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 3,
      scenario: "normal",
      completedStopIds: ["tea"],
      bookingIds: [],
      activeView: "route",
      wishlistPlaceIds: [],
    }));
    render(<TripPlanner />);

    const routeView = screen.getByRole("region", { name: "路线规划" });
    const operations = within(routeView).getByRole("region", { name: "手机当日操作" });
    expect(operations).toHaveTextContent("2026.08.20");
    expect(operations).toHaveTextContent("当前站");
    expect(operations).toHaveTextContent("广州酒家文昌总店早茶");
    expect(operations).toHaveTextContent("08:20–09:25");
    expect(operations).toHaveTextContent("进度下一站");
    expect(operations).toHaveTextContent("陈家祠");
    expect(operations).toHaveTextContent("09:40");
    const nextAction = within(operations).getByRole("link", { name: /百度地图去进度下一站/ });
    expect(new URL(nextAction.getAttribute("href") ?? "").searchParams.get("destination"))
      .toBe("name:广州 陈家祠");
    expect(screen.getAllByRole("tablist", { name: "行程模式" })).toHaveLength(1);
    expect(within(routeView).queryByRole("heading", { name: /趁一日，饮啖茶/ }))
      .not.toBeInTheDocument();
    expect(within(routeView).queryByLabelText("行程关键数据")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("下一站快捷操作")).not.toBeInTheDocument();
  });

  it("keeps the full headline and four statistics on desktop", () => {
    installMatchMedia(false);
    render(<TripPlanner />);

    const routeView = screen.getByRole("region", { name: "路线规划" });
    expect(within(routeView).getByRole("heading", { name: /趁一日，饮啖茶/ }))
      .toBeInTheDocument();
    expect(within(routeView).getByLabelText("行程关键数据").children).toHaveLength(4);
    expect(within(routeView).queryByRole("region", { name: "手机当日操作" }))
      .not.toBeInTheDocument();
    expect(screen.getAllByRole("tablist", { name: "行程模式" })).toHaveLength(1);
  });

  it("shows Todo progress from unique known booking IDs only", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 3,
      scenario: "normal",
      completedStopIds: [],
      bookingIds: ["train-outbound", "stale-booking", "train-outbound"],
      activeView: "todo",
      wishlistPlaceIds: [],
    }));
    render(<TripPlanner />);

    const todoView = screen.getByRole("region", { name: "行前待办" });
    expect(within(todoView).getByText("1/5")).toBeInTheDocument();
    expect(within(todoView).getByText("20%")).toBeInTheDocument();
    const myStats = screen.getByLabelText("我的行程进度");
    expect(within(myStats).getByText("1/5")).toBeInTheDocument();
    expect(within(myStats).queryByText("3/5")).not.toBeInTheDocument();
  });

  it("keeps load, updates, and reset usable when localStorage throws SecurityError", () => {
    const securityError = new DOMException("Blocked", "SecurityError");
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw securityError;
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw securityError;
    });
    const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw securityError;
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    expect(() => render(<TripPlanner />)).not.toThrow();
    fireEvent.click(screen.getByRole("tab", { name: "下雨" }));
    expect(screen.getByRole("tab", { name: "下雨" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/雨天把时间留在室内/)).toBeInTheDocument();
    expect(setItem).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "清除本机记录" }));
    expect(screen.getByRole("tab", { name: "正常" })).toHaveAttribute("aria-selected", "true");
    expect(removeItem).toHaveBeenCalledTimes(3);
    expect(getItem).toHaveBeenCalled();
  });

  it("opens the todo view from the route booking shortcut on mobile", () => {
    installMatchMedia(true);
    window.history.replaceState(null, "", "#route");
    render(<TripPlanner />);

    const routeView = screen.getByRole("region", { name: "路线规划" });
    const shortcut = within(routeView).getByRole("link", { name: "先看预约清单" });
    expect(shortcut).toHaveAttribute("href", "#todo");
    fireEvent.click(shortcut);

    expect(document.getElementById("todo")).toHaveClass("is-active");
    expect(window.location.hash).toBe("#todo");
    const mobileNav = within(screen.getByRole("navigation", { name: "手机功能导航" }));
    expect(mobileNav.getByRole("link", { name: "待办" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("returns to the route view from the trip footer on mobile", () => {
    installMatchMedia(true);
    window.history.replaceState(null, "", "#me");
    render(<TripPlanner />);

    const myView = screen.getByRole("region", { name: "我的行程" });
    const returnLink = within(myView).getByRole("link", { name: "回到顶部 ↑" });
    expect(returnLink).toHaveAttribute("href", "#route");
    fireEvent.click(returnLink);

    expect(document.getElementById("route")).toHaveClass("is-active");
    expect(window.location.hash).toBe("#route");
    const mobileNav = within(screen.getByRole("navigation", { name: "手机功能导航" }));
    expect(mobileNav.getByRole("link", { name: "路线" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("requires confirmation before clearing local trip records", () => {
    const savedState = JSON.stringify({
      version: 3,
      scenario: "rain",
      completedStopIds: ["tea"],
      bookingIds: ["weather"],
      activeView: "me",
      wishlistPlaceIds: ["shamian"],
    });
    window.localStorage.setItem(STORAGE_KEY, savedState);
    window.localStorage.setItem(V2_STORAGE_KEY, "version-two");
    window.localStorage.setItem(LEGACY_STORAGE_KEY, "legacy");
    window.history.replaceState(null, "", "#me");
    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<TripPlanner />);

    fireEvent.click(screen.getByRole("button", { name: "清除本机记录" }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(savedState);
    expect(window.localStorage.getItem(V2_STORAGE_KEY)).toBe("version-two");
    expect(window.localStorage.getItem(LEGACY_STORAGE_KEY)).toBe("legacy");
    expect(window.location.hash).toBe("#me");

    fireEvent.click(screen.getByRole("button", { name: "清除本机记录" }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(V2_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(window.location.hash).toBe("#route");
    const mobileNav = within(screen.getByRole("navigation", { name: "手机功能导航" }));
    expect(mobileNav.getByRole("link", { name: "路线" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("tab", { name: "正常" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("TripTimeline", () => {
  it("selects a stop from the timeline and marks the current card", () => {
    const onSelect = vi.fn();
    render(
      <TripTimeline
        stops={itineraryStops.slice(1, 4)}
        selectedId="tea"
        completedIds={[]}
        onSelect={onSelect}
        onToggleComplete={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: /广州酒家.*早茶/ })).toHaveAttribute(
      "aria-current",
      "step",
    );
    fireEvent.click(screen.getByRole("button", { name: /^09:40地标陈家祠/ }));
    expect(onSelect).toHaveBeenCalledWith("chen-clan");
  });
});

describe("ScenarioSwitcher", () => {
  it("announces and switches to the rain route", () => {
    const onChange = vi.fn();
    render(<ScenarioSwitcher value="normal" onChange={onChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "下雨" }));
    expect(onChange).toHaveBeenCalledWith("rain");
  });
});

describe("BookingChecklist", () => {
  it("toggles a real booking item", () => {
    const onToggle = vi.fn();
    render(
      <BookingChecklist
        completedIds={[]}
        onToggle={onToggle}
        items={[bookingItems[0]]}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /去程高铁/ }));
    expect(onToggle).toHaveBeenCalledWith("train-outbound");
  });
});

describe("RouteDiagram", () => {
  it("shows the active route as an explicitly non-geographic diagram", () => {
    render(
      <RouteDiagram
        stops={itineraryStops.slice(1, 4)}
        selectedId="tea"
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText("游览顺序示意")).toBeInTheDocument();
    expect(screen.queryByText(/正在展开广州地图|地图暂时没有加载/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("selects a station and marks the current one", () => {
    const onSelect = vi.fn();
    render(
      <RouteDiagram
        stops={itineraryStops.slice(1, 4)}
        selectedId="tea"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("button", { name: /08:20.*广州酒家/ })).toHaveAttribute(
      "aria-current",
      "location",
    );
    fireEvent.click(screen.getByRole("button", { name: /09:40.*陈家祠/ }));
    expect(onSelect).toHaveBeenCalledWith("chen-clan");
  });

  it("renders only stops left by the selected scenario", () => {
    const rainyStops = applyScenario(itineraryStops, "rain");
    render(<RouteDiagram stops={rainyStops} selectedId="tea" onSelect={() => undefined} />);
    expect(screen.queryByRole("button", { name: /泮塘/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /珠江夜游/ })).toBeInTheDocument();
  });
});

describe("StopPhoto", () => {
  const photo = {
    src: "images/stops/02-chen-clan-academy.webp",
    alt: "陈家祠屋脊与院落",
    author: "Verified Commons author",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    modifications: "已裁切、缩放并转为 WebP",
  };

  it("renders a local lazy image with source, license and modification credits", () => {
    render(<StopPhoto photo={photo} title="陈家祠" priority={false} />);
    const image = screen.getByRole("img", { name: photo.alt });
    expect(image).toHaveAttribute("src", photo.src);
    expect(image).toHaveAttribute("loading", "lazy");
    expect(screen.getByRole("link", { name: /图片来源/ })).toHaveAttribute(
      "href",
      photo.sourceUrl,
    );
    expect(screen.getByRole("link", { name: `许可：${photo.license}` })).toHaveAttribute(
      "href",
      photo.licenseUrl,
    );
    expect(screen.getByText(`修改说明：${photo.modifications}`)).toBeVisible();
    expect(screen.queryByText(photo.alt)).not.toBeInTheDocument();
    const media = image.closest(".stop-photo-media");
    const figure = image.closest("figure");
    expect(media).toBeInTheDocument();
    expect(figure?.children).toHaveLength(2);
    expect(figure?.lastElementChild?.tagName).toBe("FIGCAPTION");
    expect(media?.nextElementSibling?.tagName).toBe("FIGCAPTION");
  });

  it("shows the 1869 Lychee Bay history note as a visible caption", () => {
    const lycheeBay = itineraryStops.find((stop) => stop.id === "pantang")!;
    render(<StopPhoto photo={lycheeBay.photo!} title={lycheeBay.title} priority={false} />);

    expect(screen.getByText("历史照片 · 1869 年")).toBeVisible();
    expect(screen.queryByText(lycheeBay.photo!.alt)).not.toBeInTheDocument();
  });

  it("shows a readable fallback when the local file fails", () => {
    render(<StopPhoto photo={photo} title="陈家祠" priority={false} />);
    fireEvent.error(screen.getByRole("img", { name: photo.alt }));
    const fallback = screen.getByRole("img", { name: "陈家祠照片暂不可用" });
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveClass("stop-photo-fallback");
    expect(fallback.parentElement).toHaveClass("stop-photo-media");
    expect(screen.getByRole("link", { name: /图片来源/ })).toHaveAttribute(
      "href",
      photo.sourceUrl,
    );
  });

  it("recovers immediately when a failed photo is replaced", () => {
    const { rerender } = render(<StopPhoto photo={photo} title="陈家祠" priority={false} />);
    fireEvent.error(screen.getByRole("img", { name: photo.alt }));

    const nextPhoto = {
      ...photo,
      src: "images/stops/03-lychee-bay.webp",
      alt: "旧时荔枝湾涌水道与文塔",
    };
    rerender(<StopPhoto photo={nextPhoto} title="荔枝湾" priority={false} />);

    expect(screen.getByRole("img", { name: nextPhoto.alt })).toHaveAttribute(
      "src",
      nextPhoto.src,
    );
    expect(screen.queryByText("照片暂不可用")).not.toBeInTheDocument();
  });
});

describe("photo metadata", () => {
  it("covers exactly the nine confirmed real-photo slots", () => {
    const photoStops = itineraryStops.filter((stop) => stop.photo);
    expect(photoStops.map((stop) => stop.id)).toEqual([
      "tea",
      "chen-clan",
      "pantang",
      "yongqing",
      "snacks",
      "shamian",
      "beijing-road",
      "dinner",
      "cruise",
    ]);
    for (const stop of photoStops) {
      expect(stop.photo?.src).toMatch(/^images\/stops\/\d{2}-[a-z-]+\.webp$/);
      expect(stop.photo?.alt.length).toBeGreaterThan(6);
      expect(stop.photo?.author.length).toBeGreaterThan(1);
      expect(stop.photo?.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      expect(stop.photo?.license).toMatch(/^(Public domain|CC BY(?:-SA)? \d\.\d)$/);
      expect(stop.photo?.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\//);
      expect(stop.photo?.modifications).toBe("已裁切、缩放并转为 WebP");
    }
  });

  it("adds a historical caption only to the Lychee Bay photo", () => {
    expect(
      itineraryStops
        .filter((stop) => stop.photo?.caption)
        .map((stop) => ({ id: stop.id, caption: stop.photo?.caption })),
    ).toEqual([{ id: "pantang", caption: "历史照片 · 1869 年" }]);
  });
});
