"use client";

import { calculateEditorialScore } from "./discovery-logic";
import { DiscoveryPhoto } from "./DiscoveryPhoto";
import type { DiscoveryPlace } from "./discovery-types";

export interface DiscoveryMapPlacePanelProps {
  place: DiscoveryPlace;
  onOpenDetails(id: string): void;
  onClose(): void;
}

export function DiscoveryMapPlacePanel({
  place,
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
        </div>
      </div>
    </aside>
  );
}
