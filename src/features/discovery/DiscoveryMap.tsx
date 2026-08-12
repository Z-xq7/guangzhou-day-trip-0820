"use client";

import { useState, type MouseEvent } from "react";
import type { DiscoveryPlace } from "./discovery-types";

interface DiscoveryMapProps {
  places: DiscoveryPlace[];
  selectedId: string | null;
  onSelect(id: string): void;
}

const mapBounds = { west: 113, east: 113.66, south: 22.84, north: 23.22 };

function markerPosition(place: DiscoveryPlace) {
  const projectedX = (
    (place.coordinate.lng - mapBounds.west) /
    (mapBounds.east - mapBounds.west)
  ) * 100;
  const projectedY = (
    (mapBounds.north - place.coordinate.lat) /
    (mapBounds.north - mapBounds.south)
  ) * 100;
  return {
    left: `${Math.min(98, Math.max(2, projectedX + (place.mapLabelOffset?.x ?? 0)))}%`,
    top: `${Math.min(96, Math.max(4, projectedY + (place.mapLabelOffset?.y ?? 0)))}%`,
  };
}

export function DiscoveryMap({ places, selectedId, onSelect }: DiscoveryMapProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [tapCandidates, setTapCandidates] = useState<DiscoveryPlace[]>([]);

  const selectNearestMarker = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const tapX = event.clientX - bounds.left;
    const tapY = event.clientY - bounds.top;
    const candidates = places
      .map((place) => {
        const position = markerPosition(place);
        const markerX = Number.parseFloat(position.left) / 100 * bounds.width;
        const markerY = Number.parseFloat(position.top) / 100 * bounds.height;
        return { place, distance: Math.hypot(markerX - tapX, markerY - tapY) };
      })
      .filter((candidate) => candidate.distance <= 26)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8)
      .map((candidate) => candidate.place);
    if (candidates.length === 1) {
      onSelect(candidates[0].id);
      return;
    }
    setTapCandidates(candidates);
  };

  const chooseCandidate = (place: DiscoveryPlace) => {
    setTapCandidates([]);
    onSelect(place.id);
  };

  return (
    <section id="discovery-map" className="discovery-map" aria-labelledby="discovery-map-title">
      <div className="discovery-map-heading">
        <div>
          <span className="eyebrow">STATIC MAP · 静态总览</span>
          <h2 id="discovery-map-title">30 个位置，一眼建立方向感</h2>
        </div>
        <div className="discovery-map-legend" aria-label="地图图例">
          <span><i className="is-attraction" />景点 01–21</span>
          <span><i className="is-food" />美食 22–30</span>
        </div>
      </div>

      <figure>
        <div className="discovery-map-canvas">
          {imageFailed ? (
            <div
              className="discovery-map-fallback"
              role="img"
              aria-label="广州总览底图暂不可用，仍可使用地点列表"
            >
              <strong>广州位置总览</strong>
              <span>底图暂不可用，请使用下方编号地点列表</span>
            </div>
          ) : (
            // The map is a locally cached OSM-derived WebP; no runtime map request occurs.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="images/discovery/guangzhou-overview-map.webp"
              alt="广州 30 个精选地点位置总览图"
              width="1440"
              height="900"
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
          )}
          <div
            className="discovery-map-markers"
            aria-label="地图地点标记"
            onClick={selectNearestMarker}
          >
            {places.map((place) => (
              <button
                key={place.id}
                id={`discovery-marker-${place.id}`}
                className={place.kind === "attraction" ? "is-attraction" : "is-food"}
                style={markerPosition(place)}
                type="button"
                aria-label={`地图位置 ${place.index}：${place.name}`}
                aria-pressed={selectedId === place.id}
                onClick={(event) => {
                  // Keyboard/programmatic activation has no pointer coordinates.
                  // Physical taps bubble to the map layer, which resolves dense overlaps.
                  if (event.detail === 0) {
                    event.stopPropagation();
                    onSelect(place.id);
                  }
                }}
              >
                <span>{place.index}</span>
              </button>
            ))}
          </div>
          {tapCandidates.length > 1 ? (
            <div className="discovery-map-picker" role="dialog" aria-label="选择地图地点">
              <strong>点位密集，请选择地点</strong>
              <button type="button" onClick={() => setTapCandidates([])}>关闭</button>
              <div>
                {tapCandidates.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    aria-label={`从地图选择：${place.name}`}
                    onClick={() => chooseCandidate(place)}
                  >
                    <span>{String(place.index).padStart(2, "0")}</span>
                    {place.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <figcaption>
          <strong>位置示意，不替代实时导航</strong>
          <span>编号与地点卡片一致；精确路线请从详情打开百度地图。</span>
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            底图 © OpenStreetMap contributors
          </a>
        </figcaption>
      </figure>

      <details className="discovery-map-index">
        <summary>展开无障碍编号地点表</summary>
        <ol>
          {places.map((place) => (
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
    </section>
  );
}
