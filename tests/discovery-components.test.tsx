// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoveryPlaces } from "../src/data/discovery";
import { DiscoveryCard } from "../src/features/discovery/DiscoveryCard";
import { DiscoveryMap } from "../src/features/discovery/DiscoveryMap";
import { DiscoveryPhoto } from "../src/features/discovery/DiscoveryPhoto";
import { DiscoveryView } from "../src/features/discovery/DiscoveryView";
import { defaultDiscoveryFilters } from "../src/features/discovery/discovery-logic";
import type { DiscoveryFilters } from "../src/features/discovery/discovery-types";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const chenClan = discoveryPlaces.find((place) => place.id === "chen-clan-academy")!;
const nanxin = discoveryPlaces.find((place) => place.id === "nanxin-dessert")!;

function DiscoveryHarness({
  initialFilters = defaultDiscoveryFilters,
  initialWishlist = [],
  isActive = true,
  isMobile = false,
}: {
  initialFilters?: DiscoveryFilters;
  initialWishlist?: string[];
  isActive?: boolean;
  isMobile?: boolean;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [wishlistIds, setWishlistIds] = useState(initialWishlist);

  return (
    <DiscoveryView
      isActive={isActive}
      isMobile={isMobile}
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

function DiscoveryMapSelectionHarness() {
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(
    "chen-clan-academy",
  );

  return (
    <>
      <button type="button" onClick={() => setSelectedPlaceId("chen-clan-academy")}>
        外部重新选择陈家祠
      </button>
      <DiscoveryMap
        places={discoveryPlaces}
        selectedId={selectedPlaceId}
        onSelect={setSelectedPlaceId}
      />
    </>
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
  it("renders a named core-city map and a separate Guangzhou-wide map", () => {
    render(<DiscoveryMap places={discoveryPlaces} selectedId={null} onSelect={vi.fn()} />);

    expect(screen.getByRole("img", { name: "广州核心城区景点分布图" }))
      .toHaveAttribute("src", "images/discovery/guangzhou-core-map.webp");
    expect(screen.getByRole("img", { name: "广州全域景点分布图" }))
      .toHaveAttribute("src", "images/discovery/guangzhou-full-map.webp");
    expect(screen.getByRole("heading", { name: "先看核心城区" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "再看广州全域" })).toBeVisible();
    expect(screen.getByText(/手机可左右滑动查看完整标注/)).toBeVisible();
    expect(screen.queryByText(/正在加载|可缩放地图|实时地图/)).not.toBeInTheDocument();
  });

  it("shows 21 attractions with their names directly on the two maps", () => {
    render(<DiscoveryMap places={discoveryPlaces} selectedId={null} onSelect={vi.fn()} />);

    const coreMap = screen.getByRole("group", { name: "核心城区景点标记" });
    const wideMap = screen.getByRole("group", { name: "广州全域外围景点标记" });
    expect(within(coreMap).getAllByRole("button")).toHaveLength(16);
    expect(within(wideMap).getAllByRole("button")).toHaveLength(5);
    expect(within(coreMap).getByText("陈家祠")).toBeVisible();
    expect(within(coreMap).getByText("广州塔")).toBeVisible();
    expect(within(wideMap).getByText("白云山")).toBeVisible();
    expect(within(wideMap).getByText("长隆旅游度假区")).toBeVisible();
    expect(screen.queryByRole("button", { name: /广州酒家文昌总店/ })).not.toBeInTheDocument();
  });

  it("selects a named static marker and opens its photo summary", () => {
    const onSelect = vi.fn();
    render(
      <DiscoveryMap
        places={discoveryPlaces}
        selectedId="chen-clan-academy"
        onSelect={onSelect}
        onOpenDetails={vi.fn()}
      />,
    );

    const marker = screen.getByRole("button", { name: "核心城区位置 1：陈家祠" });
    expect(marker).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "核心城区位置 13：广州塔" }));
    expect(onSelect).toHaveBeenCalledWith("canton-tower");

    const panel = screen.getByRole("complementary", { name: "地图所选地点：陈家祠" });
    expect(within(panel).getByText("站内推荐 4.8")).toBeVisible();
    expect(within(panel).getByRole("img", { name: chenClan.photo.alt })).toBeVisible();
    expect(within(panel).queryByText(/距离起点|直线距离|百度|高德|导航/))
      .not.toBeInTheDocument();

    const coreHeading = screen.getByRole("heading", { name: "先看核心城区" });
    const wideHeading = screen.getByRole("heading", { name: "再看广州全域" });
    expect(coreHeading.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(panel.compareDocumentPosition(wideHeading) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it("closes the selection and returns focus to the static marker", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    render(<DiscoveryMapSelectionHarness />);

    fireEvent.click(screen.getByRole("button", { name: "关闭地图地点卡" }));

    const marker = screen.getByRole("button", { name: "核心城区位置 1：陈家祠" });
    expect(document.activeElement).toBe(marker);
    expect(screen.queryByRole("complementary", { name: "地图所选地点：陈家祠" }))
      .not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "外部重新选择陈家祠" }));
    expect(screen.getByRole("complementary", { name: "地图所选地点：陈家祠" }))
      .toBeVisible();
    vi.unstubAllGlobals();
  });

  it("focuses a static marker when a card asks to reveal it", () => {
    render(
      <DiscoveryMap
        places={discoveryPlaces}
        selectedId="chen-clan-academy"
        onSelect={vi.fn()}
        focusRequest={{ id: "chen-clan-academy", requestId: 1 }}
      />,
    );

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "核心城区位置 1：陈家祠" }),
    );
  });

  it("keeps a semantic 21-attraction index with the selected location exposed", () => {
    render(
      <DiscoveryMap
        places={discoveryPlaces}
        selectedId="shamian"
        onSelect={vi.fn()}
      />,
    );

    const list = screen.getByRole("list", { name: "广州景点编号表" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(21);
    expect(screen.getByRole("link", { name: "05 沙面 · 荔湾" }))
      .toHaveAttribute("aria-current", "location");
    expect(screen.getByText("地图为位置示意，不替代实时导航")).toBeVisible();
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
    expect(within(region).getByText("静态双层景点地图")).toBeVisible();
    expect(within(region).queryByText("可缩放全城地图")).not.toBeInTheDocument();
    expect(within(region).queryByText("两点直线距离比较")).not.toBeInTheDocument();
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

  it("keeps marker selection on the map and reveals the card only from the place panel", () => {
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

    const marker = screen.getByRole("button", { name: "核心城区位置 1：陈家祠" });
    marker.focus();
    fireEvent.click(marker);

    expect(document.activeElement).toBe(marker);
    expect(scrollIntoView).not.toHaveBeenCalled();

    const panel = screen.getByRole("complementary", { name: "地图所选地点：陈家祠" });
    fireEvent.click(within(panel).getByRole("button", { name: "查看陈家祠完整介绍" }));
    expect(document.activeElement).toBe(document.getElementById("discovery-card-chen-clan-academy"));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    vi.unstubAllGlobals();
  });

  it("scrolls the card map action to the map container instead of a fallback marker", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    render(<DiscoveryHarness />);

    fireEvent.click(screen.getByRole("button", { name: "查看陈家祠详情" }));
    const map = document.getElementById("discovery-map")!;
    const marker = screen.getByRole("button", { name: "核心城区位置 1：陈家祠" });
    const mapScrollIntoView = vi.fn();
    const markerScrollIntoView = vi.fn();
    Object.defineProperty(map, "scrollIntoView", {
      configurable: true,
      value: mapScrollIntoView,
    });
    Object.defineProperty(marker, "scrollIntoView", {
      configurable: true,
      value: markerScrollIntoView,
    });

    fireEvent.click(screen.getByRole("button", { name: "在总览图查看陈家祠" }));
    expect(mapScrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    expect(markerScrollIntoView).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("focuses the named static marker when an already selected card returns to the map", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    render(<DiscoveryHarness />);

    fireEvent.click(screen.getByRole("button", { name: "查看陈家祠详情" }));
    fireEvent.click(screen.getByRole("button", { name: "在总览图查看陈家祠" }));

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "核心城区位置 1：陈家祠" }),
    );
    vi.unstubAllGlobals();
  });

  it("disables smooth panel-to-card motion when the user prefers reduced motion", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    render(<DiscoveryHarness />);

    fireEvent.click(screen.getByRole("button", { name: "核心城区位置 1：陈家祠" }));
    const panel = screen.getByRole("complementary", { name: "地图所选地点：陈家祠" });
    fireEvent.click(within(panel).getByRole("button", { name: "查看陈家祠完整介绍" }));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
    vi.unstubAllGlobals();
  });

  it("keeps the static overview available in an inactive mobile discovery view", () => {
    render(<DiscoveryHarness isMobile isActive={false} />);

    expect(document.getElementById("discover")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("img", { name: "广州核心城区景点分布图", hidden: true }))
      .toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "核心城区位置 1：陈家祠" }));

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
