"use client";

import type { ItineraryStop } from "../../data/types";

interface RouteDiagramProps {
  stops: ItineraryStop[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function RouteDiagram({ stops, selectedId, onSelect }: RouteDiagramProps) {
  const diagramStops = stops.filter((stop) => stop.showOnMap);

  return (
    <div className="route-diagram" role="region" aria-label="广州一日游游览顺序示意">
      <div className="route-diagram-heading">
        <div><span>LOCAL ROUTE</span><strong>广州老城一日线</strong></div>
        <small>游览顺序示意</small>
      </div>
      <ol>
        {diagramStops.map((stop, index) => (
          <li key={stop.id}>
            <button
              type="button"
              aria-current={selectedId === stop.id ? "location" : undefined}
              aria-label={`${stop.start} ${stop.title}`}
              onClick={() => onSelect(stop.id)}
            >
              <span className="route-diagram-number">{index + 1}</span>
              <span className="route-diagram-copy">
                <small>{stop.start} · {stop.category}</small>
                <strong>{stop.shortTitle}</strong>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
