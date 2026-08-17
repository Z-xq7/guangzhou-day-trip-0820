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
  it("centers themed place and cluster icons on exact 44px geometry", async () => {
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
      places: discoveryPlaces,
      selectedId: null,
      reducedMotion: true,
      onMarkerSelect: () => {},
      onFirstTileLoad: () => {},
      onTileError: () => {},
    });

    const cluster = container.querySelector<HTMLElement>(".osm-map-cluster");
    expect(cluster).not.toBeNull();
    expect(cluster?.style.width).toBe("44px");
    expect(cluster?.style.height).toBe("44px");
    expect(cluster?.style.marginLeft).toBe("-22px");
    expect(cluster?.style.marginTop).toBe("-22px");

    controller.focusPlace("chen-clan-academy", false);
    const attraction = container.querySelector<HTMLElement>('[title="陈家祠"]');
    expect(attraction).not.toBeNull();
    expect(attraction?.classList.contains("osm-map-marker--attraction")).toBe(true);
    expect(attraction?.style.width).toBe("44px");
    expect(attraction?.style.height).toBe("44px");
    expect(attraction?.style.marginLeft).toBe("-22px");
    expect(attraction?.style.marginTop).toBe("-22px");

    controller.focusPlace("nanxin-dessert", false);
    expect(container.querySelector('[title="南信牛奶甜品专家"]')?.classList.contains(
      "osm-map-marker--food",
    )).toBe(true);
    controller.destroy();
  });

  it("keeps controlled selection semantics after a clustered marker is revealed", async () => {
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
      places: discoveryPlaces,
      selectedId: null,
      reducedMotion: true,
      onMarkerSelect: () => {},
      onFirstTileLoad: () => {},
      onTileError: () => {},
    });

    controller.setSelectedPlace("chen-clan-academy");
    controller.focusPlace("chen-clan-academy", false);
    await Promise.resolve();

    const marker = container.querySelector<HTMLElement>('[title="陈家祠"]');
    expect(marker?.classList.contains("is-selected")).toBe(true);
    expect(marker?.getAttribute("aria-current")).toBe("location");
    expect(marker?.getAttribute("aria-pressed")).toBe("true");
    expect(dom.window.document.activeElement).toBe(marker);

    controller.setSelectedPlace(null);
    expect(marker?.classList.contains("is-selected")).toBe(false);
    expect(marker?.hasAttribute("aria-current")).toBe(false);
    expect(marker?.getAttribute("aria-pressed")).toBe("false");
    controller.destroy();
  });

  it("keeps focus on the latest place when animated focus requests overlap", async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
      pretendToBeVisual: true,
    });
    const browserGlobals = globalThis as typeof globalThis & Record<string, unknown>;
    browserGlobals.window = dom.window;
    browserGlobals.document = dom.window.document;
    browserGlobals.HTMLElement = dom.window.HTMLElement;
    browserGlobals.Element = dom.window.Element;
    browserGlobals.SVGElement = dom.window.SVGElement;

    const container = dom.window.document.createElement("div");
    Object.defineProperties(container, {
      clientHeight: { value: 500 },
      clientWidth: { value: 700 },
    });
    dom.window.document.body.append(container);
    const controller = await createOsmMap({
      container,
      places: discoveryPlaces,
      selectedId: null,
      reducedMotion: false,
      onMarkerSelect: () => {},
      onFirstTileLoad: () => {},
      onTileError: () => {},
    });

    controller.focusPlace("chen-clan-academy");
    controller.focusPlace("canton-tower");
    await Promise.resolve();

    expect(dom.window.document.activeElement?.getAttribute("title")).toBe("广州塔");
    controller.destroy();
  });

  it("activates a real marker once with Enter and once with Space", async () => {
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
    const onMarkerSelect = vi.fn();
    const controller = await createOsmMap({
      container,
      places: discoveryPlaces.slice(0, 1),
      selectedId: null,
      reducedMotion: true,
      onMarkerSelect,
      onFirstTileLoad: () => {},
      onTileError: () => {},
    });
    const marker = container.querySelector<HTMLElement>('[title="陈家祠"]')!;

    const enter = new dom.window.KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
    });
    marker.dispatchEvent(enter);
    marker.dispatchEvent(new dom.window.KeyboardEvent("keypress", {
      bubbles: true,
      key: "Enter",
    }));
    expect(enter.defaultPrevented).toBe(true);
    expect(onMarkerSelect).toHaveBeenCalledTimes(1);

    const space = new dom.window.KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: " ",
    });
    marker.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(true);
    expect(onMarkerSelect).toHaveBeenCalledTimes(2);
    controller.destroy();
  });

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

  it("switches to OSM France at 3000ms and reports only its first successful tile", async () => {
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
      const onFirstTileLoad = vi.fn();
      const controller = await createOsmMap({
        container,
        places: discoveryPlaces.slice(0, 1),
        selectedId: null,
        reducedMotion: false,
        onMarkerSelect: () => {},
        onFirstTileLoad,
        onTileError: () => {},
      });

      expect(
        container.querySelector('img.leaflet-tile[src*="tile.openstreetmap.fr/osmfr"]'),
      ).toBeNull();
      await vi.advanceTimersByTimeAsync(2999);
      expect(
        container.querySelector('img.leaflet-tile[src*="tile.openstreetmap.fr/osmfr"]'),
      ).toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      expect(
        container.querySelector('img.leaflet-tile[src*="tile.openstreetmap.fr/osmfr"]'),
      ).not.toBeNull();
      const backupTiles = container.querySelectorAll<HTMLImageElement>(
        'img.leaflet-tile[src*="tile.openstreetmap.fr/osmfr"]',
      );
      backupTiles[0].dispatchEvent(new dom.window.Event("load"));
      backupTiles[1].dispatchEvent(new dom.window.Event("load"));
      expect(onFirstTileLoad).toHaveBeenCalledTimes(1);
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
