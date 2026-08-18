"use client";

import { useEffect, type CSSProperties } from "react";
import { DiscoveryMapPlacePanel } from "./DiscoveryMapPlacePanel";
import type { DiscoveryPlace } from "./discovery-types";

export interface DiscoveryMapProps {
  places: DiscoveryPlace[];
  selectedId: string | null;
  onSelect(id: string | null): void;
  instanceId?: string;
  showIndex?: boolean;
  enabled?: boolean;
  onOpenDetails?(id: string): void;
  focusRequest?: { id: string; requestId: number } | null;
}

type MarkerPosition = {
  left: number;
  top: number;
  labelSide: "left" | "right" | "top" | "bottom";
};

const corePositions: Record<string, MarkerPosition> = {
  "chen-clan-academy": { left: 20, top: 28, labelSide: "left" },
  yongqingfang: { left: 19, top: 42, labelSide: "left" },
  "cantonese-opera-museum": { left: 26, top: 45, labelSide: "bottom" },
  "liwan-lake-lychee-bay": { left: 18, top: 34, labelSide: "left" },
  shamian: { left: 16, top: 52, labelSide: "left" },
  "beijing-road": { left: 34, top: 35, labelSide: "top" },
  "dafo-temple": { left: 39, top: 36, labelSide: "right" },
  "sacred-heart-cathedral": { left: 31, top: 46, labelSide: "bottom" },
  "nanyue-king-museum": { left: 29, top: 18, labelSide: "left" },
  "sun-yat-sen-memorial-hall": { left: 35, top: 23, labelSide: "right" },
  "yuexiu-park": { left: 40, top: 14, labelSide: "right" },
  dongshankou: { left: 45, top: 31, labelSide: "top" },
  "canton-tower": { left: 57, top: 49, labelSide: "bottom" },
  "huacheng-square": { left: 59, top: 31, labelSide: "top" },
  "guangdong-museum": { left: 64, top: 38, labelSide: "right" },
  "pearl-river-cruise": { left: 38, top: 47, labelSide: "right" },
};

const widePositions: Record<string, MarkerPosition> = {
  "baiyun-mountain": { left: 37, top: 52, labelSide: "left" },
  "south-china-botanical-garden": { left: 49, top: 52, labelSide: "right" },
  "haizhu-wetland": { left: 49, top: 66, labelSide: "right" },
  "chimelong-resort": { left: 47, top: 70, labelSide: "left" },
  "baomo-garden": { left: 42, top: 79, labelSide: "left" },
};

const shortNames: Record<string, string> = {
  "cantonese-opera-museum": "粤剧博物馆",
  "liwan-lake-lychee-bay": "荔枝湾",
  "beijing-road": "北京路",
  "sacred-heart-cathedral": "圣心大教堂",
  "nanyue-king-museum": "南越王博物院",
  dongshankou: "东山口",
  "huacheng-square": "花城广场",
  "guangdong-museum": "广东省博物馆",
  "south-china-botanical-garden": "华南植物园",
  "haizhu-wetland": "海珠湿地",
};

function markerStyle(position: MarkerPosition) {
  return {
    "--marker-left": `${position.left}%`,
    "--marker-top": `${position.top}%`,
  } as CSSProperties;
}

function markerId(instanceId: string, placeId: string) {
  return `${instanceId}-marker-${placeId}`;
}

function StaticMarker({
  place,
  position,
  selected,
  scope,
  instanceId,
  onSelect,
}: {
  place: DiscoveryPlace;
  position: MarkerPosition;
  selected: boolean;
  scope: "核心城区" | "广州全域";
  instanceId: string;
  onSelect(id: string): void;
}) {
  return (
    <button
      id={markerId(instanceId, place.id)}
      className={`discovery-static-marker label-${position.labelSide}`}
      style={markerStyle(position)}
      type="button"
      aria-label={`${scope}位置 ${place.index}：${place.name}`}
      aria-pressed={selected}
      onClick={() => onSelect(place.id)}
    >
      <span className="discovery-static-marker__number">
        {String(place.index).padStart(2, "0")}
      </span>
      <span className="discovery-static-marker__name">
        {shortNames[place.id] ?? place.name}
      </span>
    </button>
  );
}

export function DiscoveryMap({
  places,
  selectedId,
  onSelect,
  instanceId = "discovery-map",
  showIndex = true,
  onOpenDetails,
  focusRequest = null,
}: DiscoveryMapProps) {
  const attractions = places
    .filter((place) => place.kind === "attraction")
    .sort((a, b) => a.index - b.index);
  const corePlaces = attractions.filter((place) => place.index <= 16);
  const widePlaces = attractions.filter((place) => place.index >= 17);
  const selectedPlace = attractions.find((place) => place.id === selectedId) ?? null;

  useEffect(() => {
    if (!focusRequest) return;
    document.getElementById(markerId(instanceId, focusRequest.id))
      ?.focus({ preventScroll: true });
  }, [focusRequest, instanceId]);

  const closeSelectedPlace = () => {
    if (!selectedPlace) return;
    const returnId = selectedPlace.id;
    onSelect(null);
    const returnFocus = () => {
      document.getElementById(markerId(instanceId, returnId))?.focus({ preventScroll: true });
    };
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(returnFocus);
    } else {
      window.setTimeout(returnFocus, 0);
    }
  };

  return (
    <section
      id={instanceId}
      className="discovery-map"
      aria-label="广州景点分布地图"
    >
      <div className="discovery-map-heading">
        <div>
          <span className="eyebrow">GUANGZHOU ATLAS · 广州景点图</span>
          <h2 id={`${instanceId}-title`}>先看分布，再决定去哪里</h2>
          <p>地图只保留景点。名称直接写在位置旁，不再混入美食、聚合点和复杂控件。</p>
        </div>
        <div className="discovery-map-legend" aria-label="地图阅读提示">
          <span><i />01–16 核心城区</span>
          <span><i className="is-remote" />17–21 外围景点</span>
        </div>
      </div>

      <div className="discovery-map-region-guide" aria-label="广州景点区域速览">
        <span><strong>西关老城</strong>陈家祠、永庆坊、沙面</span>
        <span><strong>越秀古城</strong>北京路、纪念堂、越秀公园</span>
        <span><strong>珠江新城</strong>广州塔、花城广场、广东省博</span>
        <span><strong>南部与外围</strong>白云山、长隆、宝墨园</span>
      </div>

      <article className="discovery-map-card discovery-map-card--core">
        <div className="discovery-map-card__copy">
          <span>01–16 · 一日游最常用</span>
          <h3>先看核心城区</h3>
          <p>大多数第一次来广州会去的景点，都集中在荔湾、越秀和珠江两岸。</p>
        </div>
        <figure>
          <div className="discovery-static-map discovery-static-map--core">
            {/* Source: Government of Guangzhou, public-domain map via Wikimedia Commons. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="images/discovery/guangzhou-core-map.webp"
              alt="广州核心城区景点分布图"
              width="1890"
              height="1224"
              loading="eager"
              decoding="async"
            />
            <div className="discovery-static-map__markers" role="group" aria-label="核心城区景点标记">
              {corePlaces.map((place) => (
                <StaticMarker
                  key={place.id}
                  place={place}
                  position={corePositions[place.id]}
                  selected={selectedId === place.id}
                  scope="核心城区"
                  instanceId={instanceId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
          <figcaption>
            荔湾、越秀、海珠、天河核心区域放大；手机可左右滑动查看完整标注，点击景点名称查看照片。
          </figcaption>
        </figure>
      </article>

      {selectedPlace && selectedPlace.index <= 16 ? (
        <DiscoveryMapPlacePanel
          place={selectedPlace}
          onOpenDetails={(id) => onOpenDetails?.(id)}
          onClose={closeSelectedPlace}
        />
      ) : null}

      <article className="discovery-map-card discovery-map-card--wide">
        <div className="discovery-map-card__copy">
          <span>17–21 · 需要单独留时间</span>
          <h3>再看广州全域</h3>
          <p>白云山、植物园、长隆和宝墨园距离核心城区较远，通常不适合硬塞进老城一日线。</p>
        </div>
        <figure>
          <div className="discovery-static-map discovery-static-map--wide">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="images/discovery/guangzhou-full-map.webp"
              alt="广州全域景点分布图"
              width="1600"
              height="2165"
              loading="lazy"
              decoding="async"
            />
            <div className="discovery-static-map__core-zone" aria-hidden="true">
              <strong>01–16</strong>
              <span>核心城区</span>
            </div>
            <div
              className="discovery-static-map__markers"
              role="group"
              aria-label="广州全域外围景点标记"
            >
              {widePlaces.map((place) => (
                <StaticMarker
                  key={place.id}
                  place={place}
                  position={widePositions[place.id]}
                  selected={selectedId === place.id}
                  scope="广州全域"
                  instanceId={instanceId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
          <figcaption>
            <strong>地图为位置示意，不替代实时导航</strong>
            <a
              href="https://commons.wikimedia.org/wiki/File:Guangzhou_overall_map.jpg"
              target="_blank"
              rel="noreferrer"
            >
              原图：广州市政府 · Wikimedia Commons 公共领域
            </a>
          </figcaption>
        </figure>
      </article>

      {selectedPlace && selectedPlace.index >= 17 ? (
        <DiscoveryMapPlacePanel
          place={selectedPlace}
          onOpenDetails={(id) => onOpenDetails?.(id)}
          onClose={closeSelectedPlace}
        />
      ) : null}

      {showIndex ? (
        <details className="discovery-map-index">
          <summary>展开 21 个景点编号表</summary>
          <ol aria-label="广州景点编号表">
            {attractions.map((place) => (
              <li key={place.id}>
                <a
                  href={`#discover/${place.id}`}
                  aria-current={selectedId === place.id ? "location" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    onSelect(place.id);
                  }}
                >
                  {String(place.index).padStart(2, "0")} {place.name} · {place.district}
                </a>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}
