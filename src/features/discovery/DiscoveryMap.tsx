"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { formatDistanceKm, haversineDistanceKm } from "./discovery-distance";
import { DiscoveryMapPlacePanel } from "./DiscoveryMapPlacePanel";
import {
  createOsmMap,
  type OsmMapController,
} from "./osm-map-adapter";
import type { DiscoveryPlace } from "./discovery-types";

export interface DiscoveryMapProps {
  places: DiscoveryPlace[];
  selectedId: string | null;
  onSelect(id: string): void;
  enabled?: boolean;
  onOpenDetails?(id: string): void;
}

type LiveStatus = "idle" | "loading" | "ready" | "unavailable";

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

export function DiscoveryMap({
  places,
  selectedId,
  onSelect,
  enabled = true,
  onOpenDetails,
}: DiscoveryMapProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [tapCandidates, setTapCandidates] = useState<DiscoveryPlace[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("idle");
  const [retryKey, setRetryKey] = useState(0);
  const [controllerRevision, setControllerRevision] = useState(0);
  const [originId, setOriginId] = useState<string | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [dismissedPanelId, setDismissedPanelId] = useState<string | null>(null);
  const mapElement = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<OsmMapController | null>(null);
  const selectedIdRef = useRef(selectedId);
  const selectPlaceRef = useRef<(id: string) => void>(() => undefined);

  selectedIdRef.current = selectedId;

  const selectedPlace = selectedId && selectedId !== dismissedPanelId
    ? places.find((place) => place.id === selectedId) ?? null
    : null;
  const origin = useMemo(
    () => places.find((place) => place.id === originId) ?? null,
    [originId, places],
  );
  const destination = useMemo(
    () => places.find((place) => place.id === destinationId) ?? null,
    [destinationId, places],
  );
  const distance = origin && destination
    ? formatDistanceKm(haversineDistanceKm(origin.coordinate, destination.coordinate))
    : null;

  const selectPlace = (id: string) => {
    setDismissedPanelId(null);
    onSelect(id);
  };
  selectPlaceRef.current = selectPlace;

  useEffect(() => {
    if (!enabled || !mapElement.current) {
      setLiveStatus("idle");
      return;
    }

    let cancelled = false;
    setLiveStatus("loading");
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setLiveStatus((status) => status === "ready" ? status : "unavailable");
      }
    }, 7000);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    void createOsmMap({
      container: mapElement.current,
      places,
      selectedId: selectedIdRef.current,
      reducedMotion,
      onMarkerSelect: (id) => selectPlaceRef.current(id),
      onFirstTileLoad: () => {
        window.clearTimeout(timeout);
        if (!cancelled) setLiveStatus("ready");
      },
      onTileError: () => undefined,
    }).then((created) => {
      if (cancelled) {
        created.destroy();
        return;
      }
      controllerRef.current = created;
      setControllerRevision((revision) => revision + 1);
    }).catch(() => {
      window.clearTimeout(timeout);
      if (!cancelled) setLiveStatus("unavailable");
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [enabled, places, retryKey]);

  useEffect(() => {
    if (selectedId) controllerRef.current?.focusPlace(selectedId);
  }, [controllerRevision, selectedId]);

  useEffect(() => {
    controllerRef.current?.setDistanceLine(origin, destination);
  }, [controllerRevision, destination, origin]);

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
      selectPlace(candidates[0].id);
      return;
    }
    setTapCandidates(candidates);
  };

  const chooseCandidate = (place: DiscoveryPlace) => {
    setTapCandidates([]);
    selectPlace(place.id);
  };

  const setOrigin = (id: string) => {
    setOriginId(id);
    setDestinationId(null);
  };

  const swapDistanceEndpoints = () => {
    setOriginId(destinationId);
    setDestinationId(originId);
  };

  const clearDistanceComparison = () => {
    setOriginId(null);
    setDestinationId(null);
  };

  return (
    <section id="discovery-map" className="discovery-map" aria-labelledby="discovery-map-title">
      <div className="discovery-map-heading">
        <div>
          <span className="eyebrow">OPENSTREETMAP · 渐进地图</span>
          <h2 id="discovery-map-title">30 个位置，一眼建立方向感</h2>
        </div>
        <div className="discovery-map-legend" aria-label="地图图例">
          <span><i className="is-attraction" />景点 01–21</span>
          <span><i className="is-food" />美食 22–30</span>
        </div>
      </div>

      <div className="discovery-map-controls" aria-label="地图范围">
        <button type="button" onClick={() => controllerRef.current?.fitAllPlaces()}>
          全部地点
        </button>
        <button type="button" onClick={() => controllerRef.current?.fitGuangzhou()}>
          广州全域
        </button>
      </div>

      <div
        className="discovery-map-live-status"
        role="status"
        aria-label="实时地图状态"
        aria-live="polite"
      >
        {liveStatus === "loading" ? <span>正在加载可缩放地图</span> : null}
        {liveStatus === "ready" ? <span>可缩放地图已就绪</span> : null}
        {liveStatus === "unavailable" ? (
          <span>
            实时地图暂不可用
            <button type="button" onClick={() => setRetryKey((key) => key + 1)}>
              重试加载
            </button>
          </span>
        ) : null}
      </div>

      <figure>
        <div
          className={`discovery-map-canvas discovery-map-canvas--${liveStatus}`}
          data-live-status={liveStatus}
        >
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
              alt="广州 30 个精选地点静态回退地图"
              width="1440"
              height="900"
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
          )}
          {enabled ? (
            <div
              ref={mapElement}
              className="discovery-map-live-layer"
              aria-label="广州精选地点可缩放地图"
            />
          ) : null}
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
                    selectPlace(place.id);
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

      {selectedPlace ? (
        <DiscoveryMapPlacePanel
          place={selectedPlace}
          origin={origin}
          destination={destination}
          onSetOrigin={setOrigin}
          onSetDestination={setDestinationId}
          onOpenDetails={(id) => onOpenDetails?.(id)}
          onClose={() => setDismissedPanelId(selectedPlace.id)}
        />
      ) : null}

      <div className="discovery-map-distance">
        {origin ? <span>A 起点：{origin.name}</span> : null}
        {destination ? <span>B 终点：{destination.name}</span> : null}
        {origin && destination ? (
          <div className="discovery-map-distance__actions">
            <button type="button" onClick={swapDistanceEndpoints}>互换 A/B</button>
            <button type="button" onClick={clearDistanceComparison}>清除距离比较</button>
          </div>
        ) : null}
        <div role="status" aria-label="距离比较结果" aria-live="polite">
          {distance ? (
            <>
              <strong>{distance}</strong>
              <span>直线距离，不代表步行、驾车或公共交通里程</span>
            </>
          ) : null}
        </div>
      </div>

      <details className="discovery-map-index">
        <summary>展开无障碍编号地点表</summary>
        <ol aria-label="广州精选地点编号表">
          {places.map((place) => (
            <li key={place.id}>
              <a
                href={`#discover/${place.id}`}
                aria-current={selectedId === place.id ? "location" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  selectPlace(place.id);
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
