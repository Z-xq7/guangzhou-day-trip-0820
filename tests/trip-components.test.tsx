// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { itineraryStops } from "../src/data/itinerary";
import {
  BookingChecklist,
  ScenarioSwitcher,
  TripPlanner,
  TripTimeline,
} from "../src/features/trip/TripPlanner";
import { applyScenario } from "../src/features/trip/trip-logic";
import { RouteDiagram } from "../src/features/trip/RouteDiagram";
import { StopPhoto } from "../src/features/trip/StopPhoto";

afterEach(cleanup);

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

    fireEvent.click(screen.getByRole("button", { name: /^09:40地标陈家祠/ }));

    const navigationUrl = new URL(
      screen.getByRole("link", { name: /在百度地图打开 岭南雕花/ }).getAttribute("href") ?? "",
    );
    expect(navigationUrl.searchParams.get("origin")).toBe("name:广州 广州酒家文昌总店");
    expect(navigationUrl.searchParams.get("destination")).toBe("name:广州 陈家祠");
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
        items={[
          {
            id: "train-outbound",
            title: "去程高铁",
            status: "8 月 6 日开售",
            url: "https://www.12306.cn/",
          },
        ]}
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
