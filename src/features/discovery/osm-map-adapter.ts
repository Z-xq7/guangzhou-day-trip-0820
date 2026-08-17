import type { DiscoveryPlace } from "./discovery-types";

export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
export const GUANGZHOU_BOUNDS: [[number, number], [number, number]] = [
  [22.45, 112.95],
  [23.95, 114.08],
];

export interface OsmMapOptions {
  container: HTMLElement;
  places: DiscoveryPlace[];
  selectedId: string | null;
  reducedMotion: boolean;
  onMarkerSelect(id: string): void;
  onFirstTileLoad(): void;
  onTileError(): void;
}

export interface OsmMapController {
  focusPlace(id: string, animate?: boolean): void;
  fitAllPlaces(animate?: boolean): void;
  fitGuangzhou(animate?: boolean): void;
  setDistanceLine(from: DiscoveryPlace | null, to: DiscoveryPlace | null): void;
  invalidateSize(): void;
  destroy(): void;
}

export function placeBounds(places: DiscoveryPlace[]): [[number, number], [number, number]] {
  if (places.length === 0) {
    return GUANGZHOU_BOUNDS;
  }

  let south = places[0].coordinate.lat;
  let west = places[0].coordinate.lng;
  let north = south;
  let east = west;

  for (const place of places.slice(1)) {
    south = Math.min(south, place.coordinate.lat);
    west = Math.min(west, place.coordinate.lng);
    north = Math.max(north, place.coordinate.lat);
    east = Math.max(east, place.coordinate.lng);
  }

  return [[south, west], [north, east]];
}

export async function createOsmMap(options: OsmMapOptions): Promise<OsmMapController> {
  const L = (await import("leaflet")).default;
  (globalThis as typeof globalThis & { L?: typeof L }).L = L;
  await import("leaflet.markercluster");

  const map = L.map(options.container, { scrollWheelZoom: false });
  let firstTileLoaded = false;
  const tiles = L.tileLayer(OSM_TILE_URL, {
    minZoom: 8,
    maxZoom: 19,
    attribution: `<a href="https://www.openstreetmap.org/copyright">${OSM_ATTRIBUTION}</a>`,
  });

  tiles.on("tileload", () => {
    if (!firstTileLoaded) {
      firstTileLoaded = true;
      options.onFirstTileLoad();
    }
  });
  tiles.on("tileerror", options.onTileError);
  tiles.addTo(map);

  const markerClusterGroup = L.markerClusterGroup({
    disableClusteringAtZoom: 15,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
  });
  const markers = new Map<string, ReturnType<typeof L.marker>>();

  for (const place of options.places) {
    const index = String(place.index).padStart(2, "0");
    const marker = L.marker([place.coordinate.lat, place.coordinate.lng], {
      alt: `地图位置 ${index}：${place.name}`,
      icon: L.divIcon({
        className: `osm-map-marker osm-map-marker--${place.kind}${place.id === options.selectedId ? " is-selected" : ""}`,
        html: `<span>${index}</span>`,
      }),
      keyboard: true,
      title: place.name,
    });

    marker.on("click", () => options.onMarkerSelect(place.id));
    markers.set(place.id, marker);
    markerClusterGroup.addLayer(marker);
  }

  markerClusterGroup.addTo(map);

  let distanceLine: ReturnType<typeof L.polyline> | null = null;
  let destroyed = false;
  const shouldAnimate = (animate: boolean | undefined) => animate !== false && !options.reducedMotion;

  const fitBounds = (bounds: [[number, number], [number, number]], animate?: boolean) => {
    map.fitBounds(bounds, { animate: shouldAnimate(animate) });
  };

  const fitAllPlaces = (animate?: boolean) => {
    fitBounds(options.places.length > 0 ? placeBounds(options.places) : GUANGZHOU_BOUNDS, animate);
  };

  fitAllPlaces(false);

  return {
    focusPlace(id, animate) {
      const marker = markers.get(id);
      if (!marker) {
        return;
      }

      const zoom = Math.max(map.getZoom(), 15);
      if (shouldAnimate(animate)) {
        map.flyTo(marker.getLatLng(), zoom);
        return;
      }

      map.setView(marker.getLatLng(), zoom, { animate: false });
    },
    fitAllPlaces,
    fitGuangzhou(animate) {
      fitBounds(GUANGZHOU_BOUNDS, animate);
    },
    setDistanceLine(from, to) {
      if (distanceLine) {
        map.removeLayer(distanceLine);
        distanceLine = null;
      }

      if (!from || !to) {
        return;
      }

      distanceLine = L.polyline(
        [
          [from.coordinate.lat, from.coordinate.lng],
          [to.coordinate.lat, to.coordinate.lng],
        ],
        { color: "#2563eb", dashArray: "6 8", opacity: 0.8, weight: 3 },
      ).addTo(map);
    },
    invalidateSize() {
      map.invalidateSize();
    },
    destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;
      map.remove();
    },
  };
}
