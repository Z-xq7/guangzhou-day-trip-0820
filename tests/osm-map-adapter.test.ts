import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { discoveryPlaces } from "../src/data/discovery";
import {
  GUANGZHOU_BOUNDS,
  OSM_TILE_URL,
  createOsmMap,
  placeBounds,
} from "../src/features/discovery/osm-map-adapter";

describe("OSM adapter data contract", () => {
  it("derives bounds containing every discovery place", () => {
    const [[south, west], [north, east]] = placeBounds(discoveryPlaces);
    for (const place of discoveryPlaces) {
      expect(place.coordinate.lat).toBeGreaterThanOrEqual(south);
      expect(place.coordinate.lat).toBeLessThanOrEqual(north);
      expect(place.coordinate.lng).toBeGreaterThanOrEqual(west);
      expect(place.coordinate.lng).toBeLessThanOrEqual(east);
    }
  });

  it("uses HTTPS tiles and a wider Guangzhou view", () => {
    expect(OSM_TILE_URL).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(GUANGZHOU_BOUNDS[0][0]).toBeLessThan(22.8);
    expect(GUANGZHOU_BOUNDS[1][0]).toBeGreaterThan(23.8);
  });
});

describe("OSM adapter browser integration", () => {
  it("creates a Leaflet marker cluster map after dynamic imports", async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const browserGlobals = globalThis as typeof globalThis & Record<string, unknown>;
    browserGlobals.window = dom.window;
    browserGlobals.document = dom.window.document;
    browserGlobals.HTMLElement = dom.window.HTMLElement;
    browserGlobals.Element = dom.window.Element;
    browserGlobals.SVGElement = dom.window.SVGElement;

    const container = dom.window.document.createElement("div");
    dom.window.document.body.append(container);
    const controller = await createOsmMap({
      container,
      places: discoveryPlaces.slice(0, 1),
      selectedId: null,
      reducedMotion: false,
      onMarkerSelect: () => {},
      onFirstTileLoad: () => {},
      onTileError: () => {},
    });

    expect(() => controller.destroy()).not.toThrow();
  });
});
