// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { discoveryPlaces } from "../src/data/discovery";
import { DiscoveryCard } from "../src/features/discovery/DiscoveryCard";
import { DiscoveryPhoto } from "../src/features/discovery/DiscoveryPhoto";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const chenClan = discoveryPlaces.find((place) => place.id === "chen-clan-academy")!;
const nanxin = discoveryPlaces.find((place) => place.id === "nanxin-dessert")!;

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
