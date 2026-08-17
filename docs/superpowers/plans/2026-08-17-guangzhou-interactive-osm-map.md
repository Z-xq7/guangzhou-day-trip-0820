# Guangzhou Interactive OpenStreetMap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the discovery page’s fixed Guangzhou image with a progressively enhanced, zoomable OpenStreetMap showing all 30 verified places and straight-line distance comparison, without adding navigation.

**Architecture:** Keep the local overview image and numbered list as server-rendered fallback. Load Leaflet and OSM tiles only in the browser through a small adapter; React owns selected-place and distance state, while the adapter owns map lifecycle, clustered markers, view changes, and the A–B line. This keeps Vinext SSR and the GitHub Pages build safe when browser globals or map tiles are unavailable.

**Tech Stack:** React 19, TypeScript 5.9, Leaflet 1.9.4, Leaflet.markercluster 1.5.3, Vinext, Vite, Vitest, Testing Library, GitHub Pages, OpenStreetMap Standard tiles.

## Global Constraints

- The discovery map uses OpenStreetMap only and adds no Baidu, Amap, walking, transit, driving, or route-planning control.
- No account, API key, geolocation permission, or uploaded user data is required.
- `DiscoveryPlace.coordinate` is the only source of marker coordinates.
- Request only tiles visible in the current viewport; never prefetch or package offline tiles.
- Keep visible `© OpenStreetMap contributors` attribution.
- Keep `public/images/discovery/guangzhou-overview-map.webp` as the no-JavaScript, slow-network, and failure fallback.
- Label computed distance `直线距离，不代表步行、驾车或公共交通里程`.
- Do not change the existing one-day route page or its Baidu actions.
- All controls and marker hit areas are at least 44×44 CSS pixels.
- Both `npm run build` and `npm run build:pages` must pass.

---

## File Structure

- Create `src/features/discovery/discovery-distance.ts`: pure Haversine and formatting functions.
- Create `src/features/discovery/osm-map-adapter.ts`: Leaflet lifecycle, clusters, marker focus, view controls, and distance line.
- Create `src/features/discovery/DiscoveryMapPlacePanel.tsx`: accessible selected-place preview and distance actions.
- Modify `src/features/discovery/DiscoveryMap.tsx`: progressive enhancement, retry, comparison, and fallback semantics.
- Modify `src/features/discovery/DiscoveryView.tsx`: active-view lifecycle and map/card selection flow.
- Modify `app/globals.css`: bundled Leaflet CSS plus responsive map visuals.
- Modify `app/layout.tsx` and `static-site/index.html`: accurate interactive-map metadata.
- Create `tests/discovery-distance.test.ts` and `tests/osm-map-adapter.test.ts`.
- Modify `tests/discovery-components.test.tsx`, `tests/pages-artifact.test.mjs`, and `tests/rendered-html.test.mjs`.

---

### Task 1: Straight-line distance domain

**Files:**
- Create: `tests/discovery-distance.test.ts`
- Create: `src/features/discovery/discovery-distance.ts`

**Interfaces:**
- Consumes: `{ lat: number; lng: number }`.
- Produces: `haversineDistanceKm(from: GeoPoint, to: GeoPoint): number` and `formatDistanceKm(distanceKm: number): string`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { formatDistanceKm, haversineDistanceKm } from "../src/features/discovery/discovery-distance";

describe("discovery distance", () => {
  it("returns zero for an identical point", () => {
    const point = { lat: 23.1294, lng: 113.2443 };
    expect(haversineDistanceKm(point, point)).toBe(0);
  });

  it("measures Chen Clan Academy to Canton Tower", () => {
    const value = haversineDistanceKm(
      { lat: 23.1294, lng: 113.2443 },
      { lat: 23.1064, lng: 113.3245 },
    );
    expect(value).toBeGreaterThan(8.4);
    expect(value).toBeLessThan(8.8);
  });

  it.each([[0, "0 公里"], [0.04, "少于 0.1 公里"], [0.76, "0.8 公里"], [8.64, "8.6 公里"]])(
    "formats %s km as %s",
    (value, expected) => expect(formatDistanceKm(value as number)).toBe(expected),
  );
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/discovery-distance.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal functions**

```ts
export interface GeoPoint { lat: number; lng: number }

const EARTH_RADIUS_KM = 6371.0088;
const radians = (degrees: number) => degrees * Math.PI / 180;

export function haversineDistanceKm(from: GeoPoint, to: GeoPoint) {
  if (from.lat === to.lat && from.lng === to.lng) return 0;
  const latitudeDelta = radians(to.lat - from.lat);
  const longitudeDelta = radians(to.lng - from.lng);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat))
      * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function formatDistanceKm(distanceKm: number) {
  if (distanceKm === 0) return "0 公里";
  if (distanceKm < 0.05) return "少于 0.1 公里";
  return `${distanceKm.toFixed(1)} 公里`;
}
```

- [ ] **Step 4: Verify GREEN and commit**

Run: `npx vitest run tests/discovery-distance.test.ts tests/discovery-logic.test.ts`

Then:

```bash
git add tests/discovery-distance.test.ts src/features/discovery/discovery-distance.ts
git commit -m "feat: add discovery distance calculation"
```

---

### Task 2: Browser-only OSM adapter

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/osm-map-adapter.test.ts`
- Create: `src/features/discovery/osm-map-adapter.ts`

**Interfaces:**
- Consumes: `DiscoveryPlace[]`, a container element, and marker/tile callbacks.
- Produces:

```ts
export const OSM_TILE_URL: string;
export const OSM_ATTRIBUTION: string;
export const GUANGZHOU_BOUNDS: [[number, number], [number, number]];
export function placeBounds(places: DiscoveryPlace[]): [[number, number], [number, number]];
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
export async function createOsmMap(options: OsmMapOptions): Promise<OsmMapController>;
```

- [ ] **Step 1: Write failing contract tests**

```ts
import { describe, expect, it } from "vitest";
import { discoveryPlaces } from "../src/data/discovery";
import { GUANGZHOU_BOUNDS, OSM_TILE_URL, placeBounds } from "../src/features/discovery/osm-map-adapter";

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
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/osm-map-adapter.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Install bundled dependencies**

Run:

```bash
npm install leaflet@1.9.4 leaflet.markercluster@1.5.3
npm install --save-dev @types/leaflet @types/leaflet.markercluster
```

- [ ] **Step 4: Implement constants, bounds, and client adapter**

Use exact constants:

```ts
export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
export const GUANGZHOU_BOUNDS: [[number, number], [number, number]] = [
  [22.45, 112.95],
  [23.95, 114.08],
];
```

Inside `createOsmMap`, dynamically import `leaflet` and `leaflet.markercluster`. Create the map with `scrollWheelZoom: false`; create the tile layer with `minZoom: 8`, `maxZoom: 19`, the policy-compliant attribution link, `tileload` and `tileerror` callbacks. Create a marker cluster group with `disableClusteringAtZoom: 15`, `showCoverageOnHover: false`, and `spiderfyOnMaxZoom: true`.

Render markers with custom `L.divIcon` HTML containing the two-digit index and attraction/food class. Each marker uses `keyboard: true`, `title: place.name`, and `alt: 地图位置 <index>：<name>`. Store markers in `Map<string, L.Marker>`. Implement controller methods with `fitBounds`, reduced-motion-aware `flyTo`/`setView`, one dashed `L.polyline`, `invalidateSize`, and idempotent `map.remove()` cleanup. Never call geolocation, routing, geocoding, or tile-prefetch APIs.

- [ ] **Step 5: Verify adapter tests and both builds**

Run: `npx vitest run tests/osm-map-adapter.test.ts && npm run build && npm run build:pages`

Expected: PASS; Leaflet appears only in browser chunks.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tests/osm-map-adapter.test.ts src/features/discovery/osm-map-adapter.ts
git commit -m "feat: add client-only OpenStreetMap adapter"
```

---

### Task 3: Progressive map UI and distance comparison

**Files:**
- Create: `src/features/discovery/DiscoveryMapPlacePanel.tsx`
- Modify: `src/features/discovery/DiscoveryMap.tsx`
- Modify: `tests/discovery-components.test.tsx`

**Interfaces:**
- `DiscoveryMapProps` adds `enabled?: boolean` and `onOpenDetails?(id: string): void`.
- `DiscoveryMap` owns `originId` and `destinationId` as session-only state.
- `DiscoveryMapPlacePanel` renders one real place, photo, score, summary, and comparison actions without navigation links.

```ts
interface DiscoveryMapPlacePanelProps {
  place: DiscoveryPlace;
  origin: DiscoveryPlace | null;
  destination: DiscoveryPlace | null;
  onSetOrigin(id: string): void;
  onSetDestination(id: string): void;
  onOpenDetails(id: string): void;
  onClose(): void;
}
```

- [ ] **Step 1: Write failing component tests**

Add tests protecting these user-visible behaviors:

```ts
it("keeps the local fallback visible before live tiles are ready", () => {
  render(<DiscoveryMap places={discoveryPlaces} selectedId={null} onSelect={vi.fn()} />);
  expect(screen.getByRole("img", { name: "广州 30 个精选地点静态回退地图" })).toBeVisible();
  expect(screen.getByText("正在加载可缩放地图")).toBeVisible();
});

it("shows a selected place without navigation", () => {
  render(<DiscoveryMap places={discoveryPlaces} selectedId="chen-clan-academy" onSelect={vi.fn()} />);
  const panel = screen.getByRole("complementary", { name: "地图所选地点：陈家祠" });
  expect(within(panel).getByText("站内推荐 4.8")).toBeVisible();
  expect(within(panel).queryByText(/导航/)).not.toBeInTheDocument();
});

it("compares Chen Clan Academy with Canton Tower", () => {
  const view = render(<DiscoveryMap places={discoveryPlaces} selectedId="chen-clan-academy" onSelect={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "设陈家祠为距离起点" }));
  view.rerender(<DiscoveryMap places={discoveryPlaces} selectedId="canton-tower" onSelect={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "比较陈家祠与广州塔" }));
  expect(screen.getByText("8.6 公里")).toBeVisible();
  expect(screen.getByText("直线距离，不代表步行、驾车或公共交通里程")).toBeVisible();
});
```

Also test swap, clear, retry after unavailable status, `aria-live` distance output, keyboard-reachable place controls, and the permanent 30-item semantic list. Mock only `createOsmMap`; assert on the real React UI, not the mock.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/discovery-components.test.tsx`

Expected: FAIL because progressive status, place panel, and comparison do not exist.

- [ ] **Step 3: Implement the place panel**

Use `DiscoveryPhoto`, `calculateEditorialScore`, and accessible controls named:

- `查看<地点>完整介绍`
- `设<地点>为距离起点`
- `比较<起点>与<地点>`
- `关闭地图地点卡`

Do not call `buildDiscoveryBaiduUrl` in this component.

- [ ] **Step 4: Implement progressive enhancement and state**

`DiscoveryMap` renders the local map first, then a `ref`-backed live layer. Its statuses are `idle | loading | ready | unavailable`. On `enabled`, call `createOsmMap`; set `ready` only on the first successful tile; after seven seconds without a successful tile, retain the static map and show `实时地图暂不可用` plus `重试加载`.

Use this lifecycle shape so stale async initialization cannot attach after unmount:

```ts
useEffect(() => {
  if (!enabled || !mapElement.current) return;
  let cancelled = false;
  setLiveStatus("loading");
  const timeout = window.setTimeout(() => {
    if (!cancelled) setLiveStatus((status) => status === "ready" ? status : "unavailable");
  }, 7000);
  void createOsmMap({
    container: mapElement.current,
    places,
    selectedId,
    reducedMotion,
    onMarkerSelect: onSelect,
    onFirstTileLoad: () => {
      window.clearTimeout(timeout);
      if (!cancelled) setLiveStatus("ready");
    },
    onTileError: () => undefined,
  }).then((created) => {
    if (cancelled) created.destroy();
    else controllerRef.current = created;
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
```

Keep adapter effects separate: one focuses `selectedId`; one draws or clears the distance line. Render `全部地点` and `广州全域` controls. Render A/B names, formatted result, `互换 A/B`, and `清除距离比较`. Put status and distance result in `aria-live="polite"` regions. Keep the OSM attribution and numbered list in server HTML.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npx vitest run tests/discovery-components.test.tsx tests/discovery-distance.test.ts`

Then:

```bash
git add src/features/discovery/DiscoveryMap.tsx src/features/discovery/DiscoveryMapPlacePanel.tsx tests/discovery-components.test.tsx
git commit -m "feat: add interactive discovery map experience"
```

---

### Task 4: View linkage, responsive design, metadata, and artifacts

**Files:**
- Modify: `src/features/discovery/DiscoveryView.tsx`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `static-site/index.html`
- Modify: `tests/discovery-components.test.tsx`
- Modify: `tests/pages-artifact.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- `DiscoveryMap.enabled` receives `!isMobile || isActive`.
- Marker selection updates `selectedPlaceId` without scrolling away.
- The panel’s full-detail action scrolls to the existing card.
- The card’s map action scrolls to `#discovery-map`; `selectedId` makes the adapter focus the correct marker.

- [ ] **Step 1: Write failing integration and artifact tests**

Add tests that map selection stays on the map, full-detail scrolls to the card, a hidden mobile discovery view does not initialize live tiles, and card-to-map selection targets `#discovery-map`.

Update built-artifact expectations:

```js
assert.match(scripts.join("\n"), /tile\.openstreetmap\.org/);
assert.match(scripts.join("\n"), /OpenStreetMap contributors/);
assert.match(scripts.join("\n"), /guangzhou-overview-map\.webp/);
assert.doesNotMatch(scripts.join("\n"), /maps\.googleapis\.com|webapi\.amap\.com/);
```

Update SSR expectations to include `可缩放全城地图`, `直线距离`, the local fallback image, visible OSM attribution, and the permanent accessible numbered list.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/discovery-components.test.tsx && npm run build:pages && npm run test:pages`

Expected: FAIL because the current view scrolls immediately and production explicitly forbids Leaflet/OSM runtime.

- [ ] **Step 3: Wire the view responsibilities**

Use:

```tsx
<DiscoveryMap
  places={discoveryPlaces}
  selectedId={selectedPlaceId}
  enabled={!isMobile || isActive}
  onSelect={onSelectPlace}
  onOpenDetails={selectAndRevealCard}
/>
```

Change the card map action to select the place and reveal `discovery-map`. Change `静态地图总览` to `可缩放全城地图`.

- [ ] **Step 4: Add bundled Leaflet and responsive styling**

Add `@import "leaflet/dist/leaflet.css";` at the top of `app/globals.css`. Replace the percentage-marker styles with:

- a minimum 560px desktop map stage and at least 500px on mobile;
- an absolutely layered local image and live map, with the live layer shown only when ready;
- 44px custom markers, clusters, zoom buttons, toolbar, retry, and distance controls;
- a two-column selected-place panel on desktop and one column below 760px;
- safe bottom spacing so Leaflet attribution and the app navigation never overlap;
- wrapped controls and no minimum width at 320px;
- no fade or animated pan under `prefers-reduced-motion: reduce`.

- [ ] **Step 5: Update accurate metadata**

Use this description in both metadata surfaces:

```text
深圳出发的一日路线，加上 30 个广州景点与粤味：实景照片、透明评分、可缩放 OpenStreetMap 与两点直线距离比较。
```

- [ ] **Step 6: Verify GREEN and commit**

Run: `npm run lint && npm test`

Then:

```bash
git add src/features/discovery/DiscoveryView.tsx app/globals.css app/layout.tsx static-site/index.html tests/discovery-components.test.tsx tests/pages-artifact.test.mjs tests/rendered-html.test.mjs
git commit -m "feat: finish responsive OSM discovery map"
```

---

### Task 5: Browser acceptance, final verification, and publication

**Files:**
- Modify only a file proven necessary by a failing browser scenario; add a failing regression test before each fix.

**Interfaces:**
- Consumes the local GitHub Pages production build.
- Produces the verified public `#discover` URL.

- [ ] **Step 1: Start a production Pages preview**

Run: `npm run build:pages && npm exec vite preview -- --config vite.pages.config.ts --host 127.0.0.1`

- [ ] **Step 2: Verify desktop behavior at 1440×900**

Using the in-app browser, verify: OSM tiles load; all 30 points or clusters fit initially; `广州全域` and `全部地点` work; zoom reveals street/landmark labels; clusters expand; a place preview shows its real local photo and score; 陈家祠→广州塔 shows `8.6 公里`; swap and clear work; attribution is visible; no navigation action appears.

- [ ] **Step 3: Verify 320×568, 375×812, and 390×844**

At each viewport assert no horizontal overflow, controls are reachable above the bottom navigation, toolbar wraps, photo/text are readable, touch targets are at least 44px, and card-to-map focus reaches the right place.

- [ ] **Step 4: Verify history and network failure**

Select a place, exercise Back/Forward and refresh, then block the OSM tile host. After the timeout, verify the static map, retry button, all 30 list entries, photos, filters, and details still work. Restore the host and verify retry returns to live tiles.

- [ ] **Step 5: Fix browser findings through RED/GREEN**

For each finding: write the smallest failing automated test, observe the expected failure, implement the minimal fix, rerun the focused test and browser scenario, then commit `fix: <behavior>`.

- [ ] **Step 6: Run Lighthouse and the final completion gate**

Targets: Accessibility ≥95 and Performance ≥85.

Run:

```bash
git diff --check
npm run lint
npm test
git status --short
```

- [ ] **Step 7: Review the complete change against the design**

Read `docs/superpowers/specs/2026-08-17-guangzhou-interactive-osm-map-design.md`, then inspect `git diff b1bd473..HEAD`. Confirm OSM-only embedded map, 30 places, street zoom, clustering, two-point straight-line distance, no new navigation, no geolocation, attribution, fallback, responsive layouts, and both builds.

- [ ] **Step 8: Publish and verify the public URL**

Use `superpowers:finishing-a-development-branch`, push the exact tested branch, integrate it into the GitHub Pages source branch, monitor the Pages workflow to success, and verify `https://z-xq7.github.io/guangzhou-day-trip-0820/#discover` on desktop and mobile. Also follow `sites:sites-hosting` because `.openai/hosting.json` exists; the GitHub Pages URL remains the primary handoff because it is the user’s established accessible host.
