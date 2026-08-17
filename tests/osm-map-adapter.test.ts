import { describe, expect, it, vi } from "vitest";
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
  it("keeps the primary OSM layer when another startup tile succeeds after one tile error", async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const browserGlobals = globalThis as typeof globalThis & Record<string, unknown>;
    browserGlobals.window = dom.window;
    browserGlobals.document = dom.window.document;
    browserGlobals.HTMLElement = dom.window.HTMLElement;
    browserGlobals.Element = dom.window.Element;
    browserGlobals.SVGElement = dom.window.SVGElement;

    const container = dom.window.document.createElement("div");
    Object.defineProperties(container, {
      clientHeight: { value: 300 },
      clientWidth: { value: 400 },
    });
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

    const primaryTiles = container.querySelectorAll<HTMLImageElement>(
      'img.leaflet-tile[src*="tile.openstreetmap.org"]',
    );
    expect(primaryTiles.length).toBeGreaterThan(1);

    primaryTiles[0].dispatchEvent(new dom.window.Event("error"));
    primaryTiles[1].dispatchEvent(new dom.window.Event("load"));
    await Promise.resolve();

    expect(
      container.querySelector('img.leaflet-tile[src*="tile.openstreetmap.fr/osmfr"]'),
    ).toBeNull();

    controller.focusPlace("chen-clan-academy", false);
    expect(container.querySelector('[role="button"][title="陈家祠"]')?.getAttribute("aria-label")).toBe(
      "地图位置 01：陈家祠",
    );
    expect(() => controller.destroy()).not.toThrow();
  });

  it("tries OSM France before the seven-second static fallback when the primary host hangs", async () => {
    vi.useFakeTimers();
    try {
      const dom = new JSDOM("<!doctype html><html><body></body></html>");
      const browserGlobals = globalThis as typeof globalThis & Record<string, unknown>;
      browserGlobals.window = dom.window;
      browserGlobals.document = dom.window.document;
      browserGlobals.HTMLElement = dom.window.HTMLElement;
      browserGlobals.Element = dom.window.Element;
      browserGlobals.SVGElement = dom.window.SVGElement;

      const container = dom.window.document.createElement("div");
      Object.defineProperties(container, {
        clientHeight: { value: 300 },
        clientWidth: { value: 400 },
      });
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

      expect(
        container.querySelector('img.leaflet-tile[src*="tile.openstreetmap.fr/osmfr"]'),
      ).toBeNull();
      await vi.advanceTimersByTimeAsync(6999);
      expect(
        container.querySelector('img.leaflet-tile[src*="tile.openstreetmap.fr/osmfr"]'),
      ).not.toBeNull();
      const backupHosts = new Set(
        [...container.querySelectorAll<HTMLImageElement>('img.leaflet-tile[src*="tile.openstreetmap.fr/osmfr"]')]
          .map((tile) => new URL(tile.src).hostname),
      );
      expect(backupHosts.size).toBeGreaterThan(1);
      const osmFranceCredit = container.querySelector<HTMLAnchorElement>(
        'a[href="https://www.openstreetmap.fr/"]',
      );
      expect(osmFranceCredit?.textContent).toContain("Tiles: OSM France");
      controller.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});
