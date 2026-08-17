import type { DiscoveryPlace } from "./discovery-types";

export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_FRANCE_TILE_URL = "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
export const OSM_FRANCE_ATTRIBUTION = "Tiles: OSM France";
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
  setSelectedPlace(id: string | null): void;
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
  let usingBackupTiles = false;
  let primaryFallbackTimeout: number | null = null;
  const clearPrimaryFallbackTimeout = () => {
    if (primaryFallbackTimeout !== null) {
      window.clearTimeout(primaryFallbackTimeout);
      primaryFallbackTimeout = null;
    }
  };
  const onTileLoad = () => {
    if (!firstTileLoaded) {
      firstTileLoaded = true;
      clearPrimaryFallbackTimeout();
      options.onFirstTileLoad();
    }
  };
  const createTileLayer = (url: string, attribution: string) => {
    const layer = L.tileLayer(url, {
      minZoom: 8,
      maxZoom: 19,
      attribution,
    });
    layer.on("tileload", onTileLoad);
    return layer;
  };
  let tiles = createTileLayer(
    OSM_TILE_URL,
    `<a href="https://www.openstreetmap.org/copyright">${OSM_ATTRIBUTION}</a>`,
  );
  const switchToBackupTiles = () => {
    if (firstTileLoaded || usingBackupTiles) {
      return;
    }

    usingBackupTiles = true;
    clearPrimaryFallbackTimeout();
    map.removeLayer(tiles);
    tiles = createTileLayer(
      OSM_FRANCE_TILE_URL,
      `<a href="https://www.openstreetmap.org/copyright">${OSM_ATTRIBUTION}</a> · <a href="https://www.openstreetmap.fr/">${OSM_FRANCE_ATTRIBUTION}</a>`,
    );
    tiles.on("tileerror", options.onTileError);
    tiles.addTo(map);
  };
  tiles.on("tileerror", () => {
    options.onTileError();
  });
  primaryFallbackTimeout = window.setTimeout(switchToBackupTiles, 3000);
  tiles.addTo(map);

  let selectedPlaceId = options.selectedId;
  const createPlaceIcon = (place: DiscoveryPlace) => L.divIcon({
    className: `osm-map-marker osm-map-marker--${place.kind}${
      place.id === selectedPlaceId ? " is-selected" : ""
    }`,
    html: `<span>${String(place.index).padStart(2, "0")}</span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
  const markerClusterGroup = L.markerClusterGroup({
    animate: !options.reducedMotion,
    disableClusteringAtZoom: 15,
    iconCreateFunction(cluster) {
      const count = cluster.getChildCount();
      const size = count < 10 ? "small" : count < 20 ? "medium" : "large";
      return L.divIcon({
        className: `osm-map-cluster osm-map-cluster--${size}`,
        html: `<span>${count}</span>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
    },
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
  });
  const markers = new Map<string, ReturnType<typeof L.marker>>();
  const updateMarkerElement = (
    marker: ReturnType<typeof L.marker>,
    placeId: string,
    markerLabel: string,
  ) => {
    const element = marker.getElement();
    if (!element) {
      return;
    }

    const isSelected = selectedPlaceId === placeId;
    element.setAttribute("aria-label", markerLabel);
    element.setAttribute("aria-pressed", String(isSelected));
    element.classList.toggle("is-selected", isSelected);
    if (isSelected) {
      element.setAttribute("aria-current", "location");
    } else {
      element.removeAttribute("aria-current");
    }
  };

  for (const place of options.places) {
    const index = String(place.index).padStart(2, "0");
    const markerLabel = `地图位置 ${index}：${place.name}`;
    const marker = L.marker([place.coordinate.lat, place.coordinate.lng], {
      alt: markerLabel,
      icon: createPlaceIcon(place),
      keyboard: true,
      title: place.name,
    });

    const activateMarker = () => options.onMarkerSelect(place.id);
    marker.on("add", () => updateMarkerElement(marker, place.id, markerLabel));
    marker.on("click", () => options.onMarkerSelect(place.id));
    marker.on("keydown", (event) => {
      const keyboardEvent = event.originalEvent as KeyboardEvent;
      if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " " && keyboardEvent.key !== "Spacebar") {
        return;
      }

      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      activateMarker();
    });
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
      const focusMarker = () => {
        markerClusterGroup.zoomToShowLayer(marker, () => {
          const place = options.places.find((candidate) => candidate.id === id);
          if (place) {
            const markerLabel = `地图位置 ${String(place.index).padStart(2, "0")}：${place.name}`;
            updateMarkerElement(marker, id, markerLabel);
          }
          marker.getElement()?.focus({ preventScroll: true });
        });
      };
      if (shouldAnimate(animate)) {
        map.once("moveend", focusMarker);
        map.flyTo(marker.getLatLng(), zoom);
        return;
      }

      map.setView(marker.getLatLng(), zoom, { animate: false });
      focusMarker();
    },
    setSelectedPlace(id) {
      if (selectedPlaceId === id) {
        return;
      }

      const previousId = selectedPlaceId;
      selectedPlaceId = id;
      for (const placeId of [previousId, id]) {
        if (!placeId) {
          continue;
        }
        const place = options.places.find((candidate) => candidate.id === placeId);
        const marker = markers.get(placeId);
        if (!place || !marker) {
          continue;
        }
        marker.setIcon(createPlaceIcon(place));
        updateMarkerElement(
          marker,
          placeId,
          `地图位置 ${String(place.index).padStart(2, "0")}：${place.name}`,
        );
      }
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
      clearPrimaryFallbackTimeout();
      map.remove();
    },
  };
}
