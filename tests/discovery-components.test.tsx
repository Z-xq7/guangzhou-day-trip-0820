// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { discoveryPlaces } from "../src/data/discovery";
import { DiscoveryCard } from "../src/features/discovery/DiscoveryCard";
import { DiscoveryMap } from "../src/features/discovery/DiscoveryMap";
import { DiscoveryPhoto } from "../src/features/discovery/DiscoveryPhoto";
import { DiscoveryView } from "../src/features/discovery/DiscoveryView";
import { defaultDiscoveryFilters } from "../src/features/discovery/discovery-logic";
import type { DiscoveryFilters } from "../src/features/discovery/discovery-types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const chenClan = discoveryPlaces.find((place) => place.id === "chen-clan-academy")!;
const nanxin = discoveryPlaces.find((place) => place.id === "nanxin-dessert")!;

function DiscoveryHarness({
  initialFilters = defaultDiscoveryFilters,
  initialWishlist = [],
}: {
  initialFilters?: DiscoveryFilters;
  initialWishlist?: string[];
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [wishlistIds, setWishlistIds] = useState(initialWishlist);

  return (
    <DiscoveryView
      isActive
      isMobile={false}
      filters={filters}
      selectedPlaceId={selectedPlaceId}
      wishlistIds={wishlistIds}
      onFiltersChange={setFilters}
      onSelectPlace={setSelectedPlaceId}
      onToggleWish={(id) => setWishlistIds((current) => (
        current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
      ))}
      onClearWishlist={() => setWishlistIds([])}
    />
  );
}

function renderCard(overrides: Partial<React.ComponentProps<typeof DiscoveryCard>> = {}) {
  const props: React.ComponentProps<typeof DiscoveryCard> = {
    place: chenClan,
    expanded: false,
    wished: false,
    onOpen: vi.fn(),
    onToggleWish: vi.fn(),
    onShowOnMap: vi.fn(),
    ...overrides,
  };
  return { ...render(<DiscoveryCard {...props} />), props };
}

describe("DiscoveryCard", () => {
  it("renders an honest computed score and delegates detail opening", () => {
    const { props } = renderCard();

    expect(screen.getByText("站内推荐 4.8")).toBeVisible();
    expect(screen.getByText("暂无可核验平台分")).toBeVisible();
    expect(screen.queryByText(chenClan.description)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看陈家祠详情" }));
    expect(props.onOpen).toHaveBeenCalledWith("chen-clan-academy");
  });

  it("shows verifiable details, sources, nearby places, and a safe Baidu link", () => {
    renderCard({ expanded: true });
    const card = screen.getByRole("article", { name: "1 陈家祠" });

    expect(card).toHaveAttribute("id", "discovery-card-chen-clan-academy");
    expect(within(card).getByText(chenClan.description)).toBeVisible();
    expect(within(card).getByText("聚贤堂")).toBeVisible();
    expect(within(card).getByText(/永庆坊/)).toBeVisible();
    expect(within(card).getByText("资料核验：2026-08-12")).toBeVisible();
    expect(within(card).getByRole("link", { name: "在百度地图打开陈家祠" }))
      .toHaveAttribute("target", "_blank");
    expect(within(card).getByRole("link", { name: "参观服务 · 广东民间工艺博物馆（陈家祠）" }))
      .toHaveAttribute("rel", "noreferrer");
    expect(within(card).getByRole("button", { name: "收起陈家祠详情" })).toBeVisible();
  });

  it("only presents a platform rating when its public source is supplied", () => {
    renderCard({
      place: {
        ...chenClan,
        platformRating: {
          platform: "公开示例平台",
          score: 4.7,
          scale: 5,
          url: "https://example.com/public-rating",
          verifiedAt: "2026-08-12",
        },
      },
    });

    const rating = screen.getByRole("link", { name: "公开示例平台 4.7/5" });
    expect(rating).toHaveAttribute("href", "https://example.com/public-rating");
    expect(screen.queryByText("暂无可核验平台分")).not.toBeInTheDocument();
  });

  it("labels representative food imagery without implying store provenance", () => {
    renderCard({ place: nanxin, expanded: true });

    expect(screen.getByText("双皮奶示意，非该门店实拍")).toBeVisible();
    expect(screen.getByText("示意图，不作为门店出品承诺")).toBeVisible();
  });

  it("marks a wished place as a route candidate without rewriting the itinerary", () => {
    const { props } = renderCard({ wished: true });

    const remove = screen.getByRole("button", { name: "从想去清单移除陈家祠" });
    expect(remove).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("已加入路线候选，不会改写 8 月 20 日主线")).toBeVisible();
    fireEvent.click(remove);
    expect(props.onToggleWish).toHaveBeenCalledWith("chen-clan-academy");
  });

  it("delegates map reveal with a unique accessible name", () => {
    const { props } = renderCard({ expanded: true });

    fireEvent.click(screen.getByRole("button", { name: "在总览图查看陈家祠" }));
    expect(props.onShowOnMap).toHaveBeenCalledWith("chen-clan-academy");
  });
});

describe("DiscoveryPhoto", () => {
  it("keeps attribution readable and replaces a failed image with an equal-ratio fallback", () => {
    render(<DiscoveryPhoto place={chenClan} priority />);

    const image = screen.getByRole("img", { name: chenClan.photo.alt });
    expect(image).toHaveAttribute("width", "1200");
    expect(image).toHaveAttribute("height", "800");
    expect(image).toHaveAttribute("loading", "eager");
    expect(screen.getByText(chenClan.photo.caption)).toBeVisible();
    const source = screen.getByRole("link", { name: `原图：${chenClan.photo.author}` });
    expect(source).toHaveAttribute("href", chenClan.photo.sourceUrl);
    expect(screen.getByRole("link", { name: `许可：${chenClan.photo.license}` }))
      .toHaveAttribute("href", chenClan.photo.licenseUrl);

    fireEvent.error(image);

    expect(screen.queryByRole("img", { name: chenClan.photo.alt })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "陈家祠景点照片暂不可用" })).toBeVisible();
    expect(screen.getByText("从原图裁切为 3:2、缩放并转换为 WebP")).toBeInTheDocument();
  });
});

describe("DiscoveryMap", () => {
  it("renders one local overview image and 30 matching numbered markers", () => {
    const onSelect = vi.fn();
    render(
      <DiscoveryMap places={discoveryPlaces} selectedId={null} onSelect={onSelect} />,
    );

    expect(screen.getByRole("img", { name: "广州 30 个精选地点位置总览图" }))
      .toHaveAttribute("src", "images/discovery/guangzhou-overview-map.webp");
    expect(screen.getAllByRole("button", { name: /^地图位置/ })).toHaveLength(30);
    expect(screen.getByText("景点 01–21")).toBeVisible();
    expect(screen.getByText("美食 22–30")).toBeVisible();
    expect(screen.getByText("位置示意，不替代实时导航")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "地图位置 1：陈家祠" }));
    expect(onSelect).toHaveBeenCalledWith("chen-clan-academy");
  });

  it("marks and exposes the selected location in the fallback list", () => {
    render(
      <DiscoveryMap
        places={discoveryPlaces}
        selectedId="shamian"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "地图位置 5：沙面" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: "05 沙面 · 荔湾" }))
      .toHaveAttribute("href", "#discover/shamian");
  });

  it("asks for an exact place when a physical tap hits a dense map cluster", () => {
    const onSelect = vi.fn();
    render(
      <DiscoveryMap places={discoveryPlaces} selectedId={null} onSelect={onSelect} />,
    );
    const markerLayer = screen.getByLabelText("地图地点标记");
    Object.defineProperty(markerLayer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        width: 660,
        height: 380,
        right: 660,
        bottom: 380,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    const shamianMarker = screen.getByRole("button", { name: "地图位置 5：沙面" });
    const x = Number.parseFloat(shamianMarker.style.left) / 100 * 660;
    const y = Number.parseFloat(shamianMarker.style.top) / 100 * 380;

    fireEvent.click(markerLayer, { clientX: x, clientY: y, detail: 1 });

    expect(screen.getByText("点位密集，请选择地点")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "从地图选择：沙面" }));
    expect(onSelect).toHaveBeenCalledWith("shamian");
  });
});

describe("DiscoveryView", () => {
  it("introduces 30 places and renders six featured choices", () => {
    render(<DiscoveryHarness />);

    const region = screen.getByRole("region", { name: "发现广州" });
    expect(within(region).getByRole("heading", { name: "30 个地方，读懂广州的古今与烟火气" }))
      .toBeVisible();
    const featured = within(region).getByLabelText("六个编辑精选");
    expect(within(featured).getAllByRole("button")).toHaveLength(6);
    expect(within(region).getByText("21 个景点 · 9 家粤味")).toBeVisible();
  });

  it("searches for double-skin milk and clears an empty result", () => {
    render(<DiscoveryHarness />);
    const search = screen.getByRole("searchbox", { name: "搜索地点、美食或主题" });

    fireEvent.change(search, { target: { value: "双皮奶" } });
    expect(screen.getByText("找到 1 个地方")).toBeVisible();
    expect(screen.getByRole("article", { name: "28 南信牛奶甜品专家" })).toBeVisible();
    expect(screen.queryByRole("article", { name: "1 陈家祠" })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "绝对不存在的地点" } });
    expect(screen.getByText("没有找到符合条件的地方")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "清除所有发现筛选" }));
    expect(screen.getByText("找到 30 个地方")).toBeVisible();
  });

  it("composes food and Liwan filters, then sorts by couple fit", () => {
    render(<DiscoveryHarness />);

    fireEvent.click(screen.getByRole("button", { name: "只看美食" }));
    fireEvent.click(screen.getByRole("button", { name: "筛选行政区：荔湾" }));
    const results = screen.getByRole("region", { name: "发现地点列表" });
    expect(within(results).getAllByRole("article").length).toBeGreaterThan(0);
    expect(within(results).queryByText("陈家祠")).not.toBeInTheDocument();
    expect(within(results).getByText("南信牛奶甜品专家")).toBeVisible();

    fireEvent.change(screen.getByRole("combobox", { name: "发现地点排序" }), {
      target: { value: "couple" },
    });
    expect(screen.getByRole("combobox", { name: "发现地点排序" })).toHaveValue("couple");
  });

  it("focuses the matching card from a map marker and the marker from a card", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    render(<DiscoveryHarness />);

    fireEvent.click(screen.getByRole("button", { name: "地图位置 1：陈家祠" }));
    expect(document.activeElement).toBe(document.getElementById("discovery-card-chen-clan-academy"));
    expect(scrollIntoView).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "在总览图查看陈家祠" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "地图位置 1：陈家祠" }));
    vi.unstubAllGlobals();
  });

  it("reveals a map-selected card even when the current filters exclude it", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    render(<DiscoveryHarness initialFilters={{
      ...defaultDiscoveryFilters,
      query: "双皮奶",
      kind: "food",
      districts: ["荔湾"],
    }} />);

    expect(screen.getByText("找到 1 个地方")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "地图位置 1：陈家祠" }));

    expect(screen.getByRole("article", { name: "1 陈家祠" })).toBeVisible();
    expect(screen.getByRole("button", { name: "收起陈家祠详情" })).toBeVisible();
    expect(screen.getByText("1 个筛选结果 · 另显示地图所选地点")).toBeVisible();
    vi.unstubAllGlobals();
  });

  it("manages a separately filtered wishlist without changing the main catalog", () => {
    render(<DiscoveryHarness initialWishlist={["shamian", "nanxin-dessert"]} />);

    const panel = screen.getByRole("region", { name: "我的想去清单" });
    expect(within(panel).getByText("2 个候选")).toBeVisible();
    expect(within(panel).getByText("已加入路线候选，不会改写 8 月 20 日主线")).toBeVisible();
    fireEvent.click(within(panel).getByRole("button", { name: "想去清单只看美食" }));
    expect(within(panel).getByRole("button", { name: "移除想去：南信牛奶甜品专家" })).toBeVisible();
    expect(within(panel).queryByRole("button", { name: "移除想去：沙面" })).not.toBeInTheDocument();

    fireEvent.click(within(panel).getByRole("button", { name: "清空想去" }));
    expect(within(panel).getByText("还没有想去地点")) .toBeVisible();
    expect(screen.getByText("找到 30 个地方")).toBeVisible();
  });
});
