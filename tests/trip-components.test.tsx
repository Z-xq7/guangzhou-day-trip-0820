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
import {
  MAP_LOAD_ROOT_MARGIN,
  MAP_MARKER_SIZE,
  RouteFallback,
} from "../src/features/trip/TripMap";

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
    expect(JSON.parse(window.localStorage.getItem("guangzhou-day-trip:v1") ?? "{}").scenario).toBe(
      "rain",
    );
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

describe("RouteFallback", () => {
  it("keeps the route usable when map tiles are unavailable", () => {
    const onSelect = vi.fn();
    render(
      <RouteFallback
        stops={itineraryStops.slice(1, 4)}
        selectedId="tea"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("地图暂时没有加载出来")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /陈家祠/ }));
    expect(onSelect).toHaveBeenCalledWith("chen-clan");
  });

  it("keeps interactive map markers at the 44px mobile touch-target minimum", () => {
    expect(MAP_MARKER_SIZE).toBe(44);
  });

  it("defers the heavy map bundle until the route is near the viewport", () => {
    expect(MAP_LOAD_ROOT_MARGIN).toBe("300px");
  });
});
