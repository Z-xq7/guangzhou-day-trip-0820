"use client";

import { useMemo, useState } from "react";
import { discoveryPlaces, featuredDiscoveryIds } from "../../data/discovery";
import {
  defaultDiscoveryFilters,
  filterDiscoveryPlaces,
  sortDiscoveryPlaces,
} from "./discovery-logic";
import type {
  DiscoveryAudience,
  DiscoveryFilters,
  DiscoveryKind,
  DiscoverySort,
  PriceLevel,
} from "./discovery-types";
import { DiscoveryCard } from "./DiscoveryCard";
import { DiscoveryMap } from "./DiscoveryMap";

export interface DiscoveryViewProps {
  isActive: boolean;
  isMobile: boolean;
  filters: DiscoveryFilters;
  selectedPlaceId: string | null;
  wishlistIds: string[];
  onFiltersChange(filters: DiscoveryFilters): void;
  onSelectPlace(id: string | null): void;
  onToggleWish(id: string): void;
  onClearWishlist(): void;
}

const featuredPlaces = featuredDiscoveryIds
  .map((id) => discoveryPlaces.find((place) => place.id === id))
  .filter((place) => place !== undefined);
const districts = [...new Set(discoveryPlaces.map((place) => place.district))];
const themes = [...new Set(discoveryPlaces.flatMap((place) => place.themes))];
const audienceOptions: Array<{ value: DiscoveryAudience; label: string }> = [
  { value: "couple", label: "情侣优先" },
  { value: "family", label: "亲子友好" },
  { value: "elder", label: "长辈友好" },
  { value: "rain", label: "雨天可去" },
  { value: "night", label: "适合夜游" },
];
const priceOptions: Array<{ value: PriceLevel; label: string }> = [
  { value: "free", label: "免费" },
  { value: "low", label: "低预算" },
  { value: "medium", label: "中等" },
  { value: "high", label: "高预算" },
];
const sortOptions: Array<{ value: DiscoverySort; label: string }> = [
  { value: "editorial", label: "站内推荐" },
  { value: "couple", label: "情侣适配" },
  { value: "family", label: "亲子适配" },
  { value: "duration", label: "停留时间短优先" },
  { value: "budget", label: "预算低优先" },
];

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

function revealElement(id: string) {
  const prefersReducedMotion = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => {
    const element = document.getElementById(id);
    element?.scrollIntoView({
      block: "center",
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
    element?.focus({ preventScroll: true });
  });
}

export function DiscoveryView({
  isActive,
  isMobile,
  filters,
  selectedPlaceId,
  wishlistIds,
  onFiltersChange,
  onSelectPlace,
  onToggleWish,
  onClearWishlist,
}: DiscoveryViewProps) {
  const [onlyWishlist, setOnlyWishlist] = useState(false);
  const [wishlistKind, setWishlistKind] = useState<"all" | DiscoveryKind>("all");
  const filteredPlaces = useMemo(() => {
    const filtered = filterDiscoveryPlaces(discoveryPlaces, filters)
      .filter((place) => !onlyWishlist || wishlistIds.includes(place.id));
    return sortDiscoveryPlaces(filtered, filters.sort);
  }, [filters, onlyWishlist, wishlistIds]);
  const selectedPlace = selectedPlaceId
    ? discoveryPlaces.find((place) => place.id === selectedPlaceId)
    : undefined;
  const selectedIsOutsideFilters = Boolean(
    selectedPlace && !filteredPlaces.some((place) => place.id === selectedPlace.id),
  );
  const displayedPlaces = selectedPlace && selectedIsOutsideFilters
    ? [selectedPlace, ...filteredPlaces]
    : filteredPlaces;
  const wishlistPlaces = discoveryPlaces.filter((place) => (
    wishlistIds.includes(place.id) && (wishlistKind === "all" || place.kind === wishlistKind)
  ));

  const updateFilters = <K extends keyof DiscoveryFilters>(
    key: K,
    value: DiscoveryFilters[K],
  ) => onFiltersChange({ ...filters, [key]: value });

  const selectAndRevealCard = (id: string) => {
    onSelectPlace(id);
    revealElement(`discovery-card-${id}`);
  };

  const selectAndRevealMap = (id: string) => {
    onSelectPlace(id);
    revealElement("discovery-map");
  };

  return (
    <section
      id="discover"
      className={`app-view discovery-view${isActive ? " is-active" : ""}`}
      aria-label="发现广州"
      aria-hidden={isMobile && !isActive ? "true" : undefined}
    >
      <header className="discovery-hero">
        <div className="discovery-hero-copy">
          <span className="eyebrow">DISCOVER GUANGZHOU · 发现广州</span>
          <h1>30 个地方，读懂广州的古今与烟火气</h1>
          <p>从岭南古建、珠江夜色到一盅两件：21 个景点、9 家粤味，按情侣体验优先整理。</p>
          <div className="discovery-hero-stats">
            <strong>21 个景点 · 9 家粤味</strong>
            <span>真实授权照片</span>
            <span>站内透明评分</span>
            <span>可缩放全城地图</span>
            <span>两点直线距离比较</span>
          </div>
        </div>
        <div className="discovery-featured" aria-label="六个编辑精选">
          {featuredPlaces.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() => selectAndRevealCard(place.id)}
            >
              <span>{String(place.index).padStart(2, "0")}</span>
              <strong>{place.name}</strong>
              <small>{place.summary}</small>
            </button>
          ))}
        </div>
      </header>

      <div className="discovery-workspace">
        <aside className="discovery-filters" aria-label="发现筛选器">
          <label className="discovery-search">
            <span>搜索地点、美食或主题</span>
            <input
              type="search"
              value={filters.query}
              placeholder="例如：双皮奶、西关、雨天"
              onChange={(event) => updateFilters("query", event.target.value)}
            />
          </label>

          <fieldset>
            <legend>类型</legend>
            <div className="discovery-filter-row">
              {([
                ["all", "全部"],
                ["attraction", "只看景点"],
                ["food", "只看美食"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filters.kind === value}
                  onClick={() => updateFilters("kind", value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>行政区</legend>
            <div className="discovery-filter-row">
              {districts.map((district) => (
                <button
                  key={district}
                  type="button"
                  aria-label={`筛选行政区：${district}`}
                  aria-pressed={filters.districts.includes(district)}
                  onClick={() => updateFilters(
                    "districts",
                    toggleValue(filters.districts, district),
                  )}
                >
                  {district}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>适合谁 / 什么天气</legend>
            <div className="discovery-filter-row">
              {audienceOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={filters.audiences.includes(option.value)}
                  onClick={() => updateFilters(
                    "audiences",
                    toggleValue(filters.audiences, option.value),
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <details>
            <summary>更多筛选：主题与预算</summary>
            <fieldset>
              <legend>主题</legend>
              <div className="discovery-filter-row">
                {themes.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    aria-pressed={filters.themes.includes(theme)}
                    onClick={() => updateFilters("themes", toggleValue(filters.themes, theme))}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>预算</legend>
              <div className="discovery-filter-row">
                {priceOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={filters.priceLevels.includes(option.value)}
                    onClick={() => updateFilters(
                      "priceLevels",
                      toggleValue(filters.priceLevels, option.value),
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </details>

          <button
            type="button"
            className="discovery-only-wishlist"
            aria-pressed={onlyWishlist}
            onClick={() => setOnlyWishlist((current) => !current)}
          >
            只看想去（{wishlistIds.length}）
          </button>
        </aside>

        <main className="discovery-results">
          <div className="discovery-results-toolbar">
            <strong>
              {selectedIsOutsideFilters
                ? `${filteredPlaces.length} 个筛选结果 · 另显示地图所选地点`
                : `找到 ${filteredPlaces.length} 个地方`}
            </strong>
            <label>
              <span>排序</span>
              <select
                aria-label="发现地点排序"
                value={filters.sort}
                onChange={(event) => updateFilters("sort", event.target.value as DiscoverySort)}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <DiscoveryMap
            places={discoveryPlaces}
            selectedId={selectedPlaceId}
            enabled={!isMobile || isActive}
            onSelect={onSelectPlace}
            onOpenDetails={selectAndRevealCard}
          />

          <section className="discovery-wishlist" aria-label="我的想去清单">
            <div>
              <span className="eyebrow">WISHLIST · 想去</span>
              <h2>我的路线候选</h2>
              <strong>{wishlistIds.length} 个候选</strong>
              <p>已加入路线候选，不会改写 8 月 20 日主线</p>
            </div>
            <div className="discovery-filter-row">
              {([
                ["all", "全部"],
                ["attraction", "景点"],
                ["food", "美食"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`想去清单只看${label}`}
                  aria-pressed={wishlistKind === value}
                  onClick={() => setWishlistKind(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {wishlistPlaces.length ? (
              <ul>
                {wishlistPlaces.map((place) => (
                  <li key={place.id}>
                    <button type="button" onClick={() => selectAndRevealCard(place.id)}>
                      {String(place.index).padStart(2, "0")} {place.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`移除想去：${place.name}`}
                      onClick={() => onToggleWish(place.id)}
                    >
                      移除
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p>还没有想去地点</p>}
            {wishlistIds.length ? (
              <button type="button" onClick={onClearWishlist}>清空想去</button>
            ) : null}
          </section>

          <section className="discovery-card-grid" aria-label="发现地点列表">
            {displayedPlaces.length ? displayedPlaces.map((place) => (
              <DiscoveryCard
                key={place.id}
                place={place}
                expanded={selectedPlaceId === place.id}
                wished={wishlistIds.includes(place.id)}
                onOpen={onSelectPlace}
                onToggleWish={onToggleWish}
                onShowOnMap={selectAndRevealMap}
              />
            )) : (
              <div className="discovery-empty">
                <strong>没有找到符合条件的地方</strong>
                <p>减少一个筛选条件，或回到全部地点。</p>
                <button
                  type="button"
                  onClick={() => {
                    setOnlyWishlist(false);
                    onFiltersChange(defaultDiscoveryFilters);
                  }}
                >
                  清除所有发现筛选
                </button>
              </div>
            )}
          </section>
        </main>
      </div>
    </section>
  );
}
