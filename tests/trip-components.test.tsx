// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
} from "../src/features/trip/trip-storage";

const initialClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");

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
    expect(screen.getByText(sources[0].title)).toBeInTheDocument();
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
  it("switches all four functions and exposes the active page", () => {
    const onChange = vi.fn();
    render(<MobileAppShell activeView="route" onChange={onChange} />);

    expect(screen.getByRole("link", { name: "路线" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("link", { name: "地图" }));
    expect(onChange).toHaveBeenCalledWith("map");
    fireEvent.click(screen.getByRole("link", { name: "待办" }));
    expect(onChange).toHaveBeenCalledWith("todo");
    fireEvent.click(screen.getByRole("link", { name: "我的" }));
    expect(onChange).toHaveBeenCalledWith("me");
  });
});

describe("TripPlanner", () => {
  it("switches to the rain plan, updates the route, and saves the choice locally", () => {
    window.localStorage.clear();
    render(<TripPlanner />);

    expect(screen.getByRole("heading", { name: /趁一日，饮啖茶/ })).toBeInTheDocument();
    expect(screen.getByText("¥348–555")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "下雨" }));

    expect(screen.queryByRole("button", { name: /泮塘五约/ })).not.toBeInTheDocument();
    expect(screen.getByText(/雨天把时间留在室内/)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("guangzhou-day-trip:v2") ?? "{}").scenario).toBe(
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
      version: 2,
      scenario: "normal",
      completedStopIds: [],
      bookingIds: [],
      activeView: "map",
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
    ["missing", ""],
    ["invalid", "#unknown"],
  ])("replaces a %s initial hash with the persisted mobile view", (_kind, hash) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      scenario: "normal",
      completedStopIds: [],
      bookingIds: [],
      activeView: "map",
    }));
    window.history.replaceState(null, "", hash);
    const replaceState = vi.spyOn(window.history, "replaceState");

    render(<TripPlanner />);

    expect(window.location.hash).toBe("#map");
    expect(replaceState).toHaveBeenCalledWith(null, "", "#map");
  });

  it("marks only the active app view for assistive technology", () => {
    window.history.replaceState(null, "", "#map");
    render(<TripPlanner />);

    expect(document.getElementById("map")).toHaveClass("is-active");
    expect(document.getElementById("map")).not.toHaveAttribute("aria-hidden");
    for (const id of ["route", "todo", "me"]) {
      expect(document.getElementById(id)).not.toHaveClass("is-active");
      expect(document.getElementById(id)).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("requires confirmation before clearing local trip records", () => {
    const savedState = JSON.stringify({
      version: 2,
      scenario: "rain",
      completedStopIds: ["tea"],
      bookingIds: ["weather"],
      activeView: "me",
    });
    window.localStorage.setItem(STORAGE_KEY, savedState);
    window.localStorage.setItem(LEGACY_STORAGE_KEY, "legacy");
    window.history.replaceState(null, "", "#me");
    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<TripPlanner />);

    fireEvent.click(screen.getByRole("button", { name: "清除本机记录" }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(savedState);
    expect(window.localStorage.getItem(LEGACY_STORAGE_KEY)).toBe("legacy");
    expect(window.location.hash).toBe("#me");

    fireEvent.click(screen.getByRole("button", { name: "清除本机记录" }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
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
  };

  it("renders a local lazy image and visible credit link", () => {
    render(<StopPhoto photo={photo} title="陈家祠" priority={false} />);
    const image = screen.getByRole("img", { name: photo.alt });
    expect(image).toHaveAttribute("src", photo.src);
    expect(image).toHaveAttribute("loading", "lazy");
    expect(screen.getByRole("link", { name: /图片来源/ })).toHaveAttribute(
      "href",
      photo.sourceUrl,
    );
    expect(screen.getByText(/CC BY-SA 4.0/)).toBeInTheDocument();
  });

  it("shows a readable fallback when the local file fails", () => {
    render(<StopPhoto photo={photo} title="陈家祠" priority={false} />);
    fireEvent.error(screen.getByRole("img", { name: photo.alt }));
    expect(screen.getByRole("img", { name: "陈家祠照片暂不可用" })).toBeInTheDocument();
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
    }
  });
});
