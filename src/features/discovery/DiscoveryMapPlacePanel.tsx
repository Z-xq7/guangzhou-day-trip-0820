"use client";

import { calculateEditorialScore } from "./discovery-logic";
import { DiscoveryPhoto } from "./DiscoveryPhoto";
import type { DiscoveryPlace } from "./discovery-types";

export interface DiscoveryMapPlacePanelProps {
  place: DiscoveryPlace;
  origin: DiscoveryPlace | null;
  destination: DiscoveryPlace | null;
  onSetOrigin(id: string): void;
  onSetDestination(id: string): void;
  onOpenDetails(id: string): void;
  onClose(): void;
}

export function DiscoveryMapPlacePanel({
  place,
  origin,
  destination,
  onSetOrigin,
  onSetDestination,
  onOpenDetails,
  onClose,
}: DiscoveryMapPlacePanelProps) {
  const score = calculateEditorialScore(place).toFixed(1);

  return (
    <aside
      className="discovery-map-place-panel"
      aria-label={`地图所选地点：${place.name}`}
    >
      <div className="discovery-map-place-panel__heading">
        <div>
          <span>{String(place.index).padStart(2, "0")} · {place.district}</span>
          <h3>{place.name}</h3>
        </div>
        <button type="button" aria-label="关闭地图地点卡" onClick={onClose}>
          关闭
        </button>
      </div>

      <DiscoveryPhoto place={place} />

      <div className="discovery-map-place-panel__body">
        <strong>站内推荐 {score}</strong>
        <p>{place.summary}</p>
        <div className="discovery-map-place-panel__actions">
          <button type="button" onClick={() => onOpenDetails(place.id)}>
            查看{place.name}完整介绍
          </button>
          <button
            type="button"
            aria-pressed={origin?.id === place.id}
            onClick={() => onSetOrigin(place.id)}
          >
            设{place.name}为距离起点
          </button>
          {origin && origin.id !== place.id ? (
            <button
              type="button"
              aria-pressed={destination?.id === place.id}
              onClick={() => onSetDestination(place.id)}
            >
              比较{origin.name}与{place.name}
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
