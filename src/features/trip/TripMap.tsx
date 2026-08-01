"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { ItineraryStop } from "../../data/types";

interface RouteFallbackProps {
  stops: ItineraryStop[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export const MAP_MARKER_SIZE = 44;

export function RouteFallback({ stops, selectedId, onSelect }: RouteFallbackProps) {
  return (
    <div className="route-fallback" role="region" aria-label="路线示意图">
      <div className="fallback-copy">
        <span className="fallback-seal" aria-hidden="true">粤</span>
        <div>
          <strong>地图暂时没有加载出来</strong>
          <p>以下仍可查看完整游览顺序，并使用高德导航。</p>
        </div>
      </div>
      <ol>
        {stops.map((stop, index) => (
          <li key={stop.id}>
            <button
              type="button"
              aria-current={selectedId === stop.id ? "location" : undefined}
              onClick={() => onSelect(stop.id)}
            >
              <span>{index + 1}</span>
              {stop.title}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

type TripMapProps = RouteFallbackProps;

export function TripMap({ stops, selectedId, onSelect }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const markerRefs = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const isSelected = useEffectEvent((id: string) => id === selectedId);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || failed) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let mapInstance: import("leaflet").Map | undefined;
    const markers = new Map<string, import("leaflet").Marker>();
    markerRefs.current = markers;

    async function setupMap() {
      try {
        const L = await import("leaflet");
        if (cancelled || !containerRef.current) return;
        leafletRef.current = L;

        const mapStops = stops.filter((stop) => stop.showOnMap && stop.position);
        if (mapStops.length === 0) {
          setFailed(true);
          return;
        }

        const map = L.map(containerRef.current, {
          zoomControl: false,
          scrollWheelZoom: false,
        });
        mapInstance = map;
        mapRef.current = map;
        L.control.zoom({ position: "bottomright" }).addTo(map);

        let tileErrors = 0;
        const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        });
        tiles.on("load", () => {
          if (!cancelled) setLoaded(true);
        });
        tiles.on("tileerror", () => {
          tileErrors += 1;
          if (tileErrors >= 3 && !cancelled) setFailed(true);
        });
        tiles.addTo(map);

        const positions = mapStops.map((stop) => stop.position as [number, number]);
        L.polyline(positions, {
          color: "#b84b3b",
          weight: 4,
          opacity: 0.9,
          dashArray: "9 9",
          lineCap: "round",
        }).addTo(map);

        const makeIcon = (index: number, selected: boolean) =>
          L.divIcon({
            className: "route-marker-shell",
            html: `<span class="route-marker${selected ? " is-selected" : ""}">${index + 1}</span>`,
            iconSize: [MAP_MARKER_SIZE, MAP_MARKER_SIZE],
            iconAnchor: [MAP_MARKER_SIZE / 2, MAP_MARKER_SIZE / 2],
          });

        markerRefs.current.clear();
        mapStops.forEach((stop, index) => {
          const marker = L.marker(stop.position as [number, number], {
            icon: makeIcon(index, isSelected(stop.id)),
            title: stop.title,
          });
          marker.on("click", () => onSelect(stop.id));
          marker.bindTooltip(`${stop.start} · ${stop.shortTitle}`, { direction: "top", offset: [0, -20] });
          marker.addTo(map);
          markers.set(stop.id, marker);
        });

        map.fitBounds(L.latLngBounds(positions), { padding: [34, 34], maxZoom: 13 });
        timeoutId = setTimeout(() => {
          if (!cancelled) map.invalidateSize();
        }, 800);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    setupMap();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      markers.clear();
      mapInstance?.remove();
      if (markerRefs.current === markers) markerRefs.current = new Map();
      if (mapRef.current === mapInstance) mapRef.current = null;
    };
  }, [failed, onSelect, stops]);

  useEffect(() => {
    const L = leafletRef.current;
    if (!L) return;
    const visibleStops = stops.filter((stop) => stop.showOnMap && stop.position);
    visibleStops.forEach((stop, index) => {
      const marker = markerRefs.current.get(stop.id);
      if (!marker) return;
      marker.setIcon(
        L.divIcon({
          className: "route-marker-shell",
          html: `<span class="route-marker${stop.id === selectedId ? " is-selected" : ""}">${index + 1}</span>`,
          iconSize: [MAP_MARKER_SIZE, MAP_MARKER_SIZE],
          iconAnchor: [MAP_MARKER_SIZE / 2, MAP_MARKER_SIZE / 2],
        }),
      );
    });
    const selected = stops.find((stop) => stop.id === selectedId && stop.position);
    if (selected?.position) mapRef.current?.panTo(selected.position, { animate: true });
  }, [selectedId, stops]);

  if (failed) return <RouteFallback stops={stops} selectedId={selectedId} onSelect={onSelect} />;

  return (
    <div className="map-frame" aria-label="广州一日游互动地图">
      {!loaded && <div className="map-loading">正在展开广州地图…</div>}
      <div ref={containerRef} className="leaflet-map" />
      <div className="map-legend">
        <span><i className="legend-dot" /> 可点击站点</span>
        <span><i className="legend-line" /> 游览顺序示意</span>
      </div>
    </div>
  );
}
