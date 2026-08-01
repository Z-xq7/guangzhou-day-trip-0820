# Guangzhou Trip Mobile App, Baidu Map, and Photo Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unreliable Leaflet map with an always-available local route diagram plus Baidu Map deep links, add nine licensed real photos, and turn the mobile layout into a four-view trip app while preserving the desktop long page.

**Architecture:** Keep `TripPlanner` as the single stateful coordinator. Structured itinerary data drives reusable route, map, todo, and trip-summary views; CSS shows all views on desktop and only the active view below 760px. The page never loads a map SDK or tiles: `RouteDiagram` is local HTML/CSS, while place lookup and routing use Baidu URI URLs. Versioned local state stores the selected scenario, checklists, and active mobile view, with migration from version 1.

**Tech Stack:** React 19, TypeScript 5.9, Vite/Vinext, Vitest, Testing Library, CSS, Baidu Map URI API, local WebP assets, GitHub Pages.

## Global Constraints

- Work only in `/Users/bytedance/Desktop/travel_plan/.worktrees/github-pages-migration` on branch `feat/github-pages-migration`; the existing worktree is already the isolated implementation workspace.
- Use `apply_patch` for source edits. Do not stage `.superpowers/brainstorm/` or unrelated user files.
- Do not request a Baidu AK, browser location, account, or cloud storage.
- Do not load Leaflet, OpenStreetMap, Baidu JSAPI, static-map endpoints, `iframe` maps, or remote image hotlinks.
- Do not label the local route diagram as a geographic map. Its visible label must be `游览顺序示意`.
- Every photo must be a real local WebP whose source page and reuse license have been verified before it is referenced in code.
- All external links must use `target="_blank"` and `rel="noreferrer"`.
- Keep every interactive target at least 44×44 CSS pixels and preserve keyboard focus styles.
- Run the focused red test before implementation, the focused green test after implementation, and the full verification suite before publishing.
- Commit only after the task's tests pass. Use the exact commit boundaries listed below.

---

### Task 1: Add Baidu URI builders and version-2 local state

**Files:**

- Modify: `.gitignore`
- Modify: `src/data/types.ts`
- Modify: `src/features/trip/trip-logic.ts`
- Modify: `src/features/trip/trip-storage.ts`
- Modify: `tests/trip-logic.test.ts`
- Modify: `tests/trip-storage.test.ts`

- [ ] **Step 1: Ignore the local brainstorming artifacts**

Add this line to `.gitignore` so visual-helper output cannot enter later commits:

```gitignore
/.superpowers/
```

Then confirm that `git status --short` no longer lists `.superpowers/`.

- [ ] **Step 2: Write failing Baidu URI tests**

Replace the Amap test in `tests/trip-logic.test.ts` with exact route and place expectations:

```ts
import {
  applyScenario,
  buildBaiduMapUrl,
  buildBaiduPlaceUrl,
  summarizeBudget,
  validateSchedule,
} from "../src/features/trip/trip-logic";

describe("Baidu Map URI", () => {
  it("builds a named transit route without requesting browser location", () => {
    const url = new URL(buildBaiduMapUrl("广州南站", "广州酒家文昌总店", "bus"));

    expect(url.origin + url.pathname).toBe("https://api.map.baidu.com/direction");
    expect(url.searchParams.get("origin")).toBe("name:广州 广州南站");
    expect(url.searchParams.get("destination")).toBe("name:广州 广州酒家文昌总店");
    expect(url.searchParams.get("mode")).toBe("transit");
    expect(url.searchParams.get("region")).toBe("广州");
    expect(url.searchParams.get("output")).toBe("html");
    expect(url.searchParams.has("location")).toBe(false);
  });

  it.each([
    ["walk", "walking"],
    ["bus", "transit"],
    ["car", "driving"],
  ] as const)("maps %s to Baidu mode %s", (mode, expected) => {
    const url = new URL(buildBaiduMapUrl("陈家祠", "沙面岛", mode));
    expect(url.searchParams.get("mode")).toBe(expected);
  });

  it("builds a Guangzhou-scoped place search", () => {
    const url = new URL(buildBaiduPlaceUrl("陈家祠"));
    expect(url.origin + url.pathname).toBe("https://api.map.baidu.com/place/search");
    expect(url.searchParams.get("query")).toBe("广州 陈家祠");
    expect(url.searchParams.get("region")).toBe("广州");
  });
});
```

- [ ] **Step 3: Write failing state migration and reset tests**

Extend `MemoryStorage` in `tests/trip-storage.test.ts` with `removeItem`, then replace version-1 assertions with:

```ts
class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

it("persists version 2 including the active mobile view", () => {
  const storage = new MemoryStorage();
  const state = {
    version: 2 as const,
    scenario: "rain" as const,
    completedStopIds: ["tea"],
    bookingIds: ["train-outbound"],
    activeView: "map" as const,
  };

  saveTripState(storage, state);
  expect(loadTripState(storage)).toEqual(state);
});

it("migrates version 1 without losing trip progress", () => {
  const storage = new MemoryStorage();
  storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({
    version: 1,
    scenario: "delay",
    completedStopIds: ["chen-clan"],
    bookingIds: ["cruise-ticket"],
  }));

  expect(loadTripState(storage)).toEqual({
    version: 2,
    scenario: "delay",
    completedStopIds: ["chen-clan"],
    bookingIds: ["cruise-ticket"],
    activeView: "route",
  });
});

it("clears both current and legacy records", () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, "current");
  storage.setItem(LEGACY_STORAGE_KEY, "legacy");
  clearTripState(storage);
  expect(storage.getItem(STORAGE_KEY)).toBeNull();
  expect(storage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
});
```

Retain malformed JSON coverage and change the future-version fixture to version 3.

- [ ] **Step 4: Run the focused tests and confirm red**

Run:

```bash
npx vitest run tests/trip-logic.test.ts tests/trip-storage.test.ts
```

Expected: failures for missing `buildBaiduMapUrl`, `buildBaiduPlaceUrl`, `LEGACY_STORAGE_KEY`, `clearTripState`, and the version-2 shape.

- [ ] **Step 5: Add the domain types**

Update `src/data/types.ts` with:

```ts
export type MobileView = "route" | "map" | "todo" | "me";

export interface StopPhoto {
  src: string;
  alt: string;
  author: string;
  sourceUrl: string;
  license: string;
}

export interface TripState {
  version: 2;
  scenario: Scenario;
  completedStopIds: string[];
  bookingIds: string[];
  activeView: MobileView;
}
```

Also add `photo?: StopPhoto` to `ItineraryStop`. Leave `position` temporarily in place until the Leaflet removal task so this commit remains focused.

- [ ] **Step 6: Implement Baidu route and place URLs**

Replace `buildAmapNavigationUrl` in `trip-logic.ts` with:

```ts
const baiduModes = {
  walk: "walking",
  bus: "transit",
  car: "driving",
} as const;

const BAIDU_SOURCE = "webapp.Z-xq7.guangzhou-day-trip";

export function buildBaiduMapUrl(
  originName: string,
  destinationName: string,
  mode: "walk" | "bus" | "car",
) {
  const query = new URLSearchParams({
    origin: `name:广州 ${originName}`,
    destination: `name:广州 ${destinationName}`,
    mode: baiduModes[mode],
    region: "广州",
    output: "html",
    src: BAIDU_SOURCE,
  });
  return `https://api.map.baidu.com/direction?${query.toString()}`;
}

export function buildBaiduPlaceUrl(placeName: string) {
  const query = new URLSearchParams({
    query: `广州 ${placeName}`,
    region: "广州",
    output: "html",
    src: BAIDU_SOURCE,
  });
  return `https://api.map.baidu.com/place/search?${query.toString()}`;
}
```

- [ ] **Step 7: Implement version-2 loading, version-1 migration, and clearing**

Use these exact public constants and defaults in `trip-storage.ts`:

```ts
export const STORAGE_KEY = "guangzhou-day-trip:v2";
export const LEGACY_STORAGE_KEY = "guangzhou-day-trip:v1";

export const defaultTripState: TripState = {
  version: 2,
  scenario: "normal",
  completedStopIds: [],
  bookingIds: [],
  activeView: "route",
};
```

Extend `StorageLike` with `removeItem`. Add strict v1 and v2 guards, and make `loadTripState` prefer a valid v2 record, otherwise migrate a valid v1 record by adding `activeView: "route"`. Add:

```ts
export function clearTripState(storage: StorageLike) {
  storage.removeItem(STORAGE_KEY);
  storage.removeItem(LEGACY_STORAGE_KEY);
}

export function resetTripState() {
  clearTripState(window.localStorage);
  cachedRawState = undefined;
  window.dispatchEvent(new Event(TRIP_STATE_CHANGE_EVENT));
}
```

The guards must validate every enum and require both ID fields to be arrays of strings.

- [ ] **Step 8: Run focused tests and confirm green**

Run:

```bash
npx vitest run tests/trip-logic.test.ts tests/trip-storage.test.ts
```

Expected: all logic and storage tests pass.

- [ ] **Step 9: Commit Task 1**

```bash
git add .gitignore src/data/types.ts src/features/trip/trip-logic.ts src/features/trip/trip-storage.ts tests/trip-logic.test.ts tests/trip-storage.test.ts
git commit -m "feat: add Baidu links and versioned app state"
```

---

### Task 2: Replace Leaflet with a local interactive route diagram

**Files:**

- Create: `src/features/trip/RouteDiagram.tsx`
- Delete: `src/features/trip/TripMap.tsx`
- Modify: `src/features/trip/TripPlanner.tsx`
- Modify: `src/data/types.ts`
- Modify: `src/data/itinerary.ts`
- Modify: `tests/trip-components.test.tsx`
- Modify: `tests/pages-artifact.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Delete: `public/assets/leaflet.css`
- Delete: `public/assets/images/layers-2x.png`
- Delete: `public/assets/images/layers.png`
- Delete: `public/assets/images/marker-icon-2x.png`
- Delete: `public/assets/images/marker-icon.png`
- Delete: `public/assets/images/marker-shadow.png`

- [ ] **Step 1: Replace Leaflet component tests with route-diagram behavior tests**

Remove the `TripMap assets` and `RouteFallback` suites from `tests/trip-components.test.tsx`. Import `RouteDiagram` and add:

```tsx
describe("RouteDiagram", () => {
  it("shows the active route as an explicitly non-geographic diagram", () => {
    render(
      <RouteDiagram
        stops={itineraryStops.slice(1, 4)}
        selectedId="tea"
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText("游览顺序示意")).toBeInTheDocument();
    expect(screen.queryByText(/正在展开广州地图|地图暂时没有加载/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("selects a station and marks the current one", () => {
    const onSelect = vi.fn();
    render(
      <RouteDiagram
        stops={itineraryStops.slice(1, 4)}
        selectedId="tea"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("button", { name: /08:20.*广州酒家/ })).toHaveAttribute(
      "aria-current",
      "location",
    );
    fireEvent.click(screen.getByRole("button", { name: /09:40.*陈家祠/ }));
    expect(onSelect).toHaveBeenCalledWith("chen-clan");
  });

  it("renders only stops left by the selected scenario", () => {
    const rainyStops = applyScenario(itineraryStops, "rain");
    render(<RouteDiagram stops={rainyStops} selectedId="tea" onSelect={() => undefined} />);
    expect(screen.queryByRole("button", { name: /泮塘/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /珠江夜游/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Change the static artifact test to forbid old map assets**

Replace Leaflet asset access checks in `tests/pages-artifact.test.mjs` with:

```js
const scripts = await Promise.all(
  entryUrls
    .filter((url) => url.endsWith(".js"))
    .map((url) => readFile(new URL(url.slice(repositoryBase.length), distRoot), "utf8")),
);

assert.doesNotMatch(scripts.join("\n"), /tile\.openstreetmap\.org|leaflet/i);
await assert.rejects(access(new URL("assets/leaflet.css", distRoot)));
```

- [ ] **Step 3: Run focused tests and confirm red**

```bash
npx vitest run tests/trip-components.test.tsx
```

Expected: import failure because `RouteDiagram.tsx` does not exist.

- [ ] **Step 4: Implement `RouteDiagram` as semantic HTML**

Create `RouteDiagram.tsx`:

```tsx
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
```

This component must not use coordinates, SVG, canvas, network requests, dynamic imports, timers, or a loading state.

- [ ] **Step 5: Wire the diagram and Baidu links into the current planner**

In `TripPlanner.tsx`:

- Replace `TripMap` with `RouteDiagram`.
- Replace every `buildAmapNavigationUrl` call with `buildBaiduMapUrl`.
- Determine the route origin from the prior active stop; when the prior stop is `rail-outbound` or absent, use `广州南站`.
- Change visible labels from `高德` to `百度地图`.
- Update route-section copy from `点击地图` to `点击路线图`.

Add this helper next to `toggleId` and cover it indirectly through rendered URLs:

```ts
function getNavigationOrigin(stops: ItineraryStop[], destinationId: string) {
  const index = stops.findIndex((stop) => stop.id === destinationId);
  const previous = index > 0 ? stops[index - 1] : undefined;
  return !previous || previous.id === "rail-outbound" ? "广州南站" : previous.placeName;
}
```

- [ ] **Step 6: Remove coordinates and Leaflet dependencies/assets**

Remove `position` from `ItineraryStop` and every itinerary record. Keep `showOnMap` because it decides whether a station belongs in the Guangzhou route diagram.

Run:

```bash
npm uninstall leaflet @types/leaflet
```

Delete `TripMap.tsx`, `public/assets/leaflet.css`, and the six `public/assets/images/` files listed above. Remove the empty directories.

- [ ] **Step 7: Update the map source record**

Replace the `amap` source in `src/data/itinerary.ts` with:

```ts
{
  id: "baidu-uri",
  title: "地点搜索与路线调起 URI",
  publisher: "百度地图开放平台",
  verifiedAt: "2026-08-01",
  url: "https://lbsyun.baidu.com/docs/webapi?title=mapadjustment%2Furi",
}
```

- [ ] **Step 8: Run focused tests and build-artifact test**

```bash
npx vitest run tests/trip-components.test.tsx tests/trip-logic.test.ts
npm run build:pages
npm run test:pages
```

Expected: route interactions pass, the Pages artifact contains no Leaflet/OSM code, and old map assets are absent.

- [ ] **Step 9: Commit Task 2**

```bash
git add src/features/trip/RouteDiagram.tsx src/features/trip/TripPlanner.tsx src/data/types.ts src/data/itinerary.ts tests/trip-components.test.tsx tests/pages-artifact.test.mjs package.json package-lock.json
git add -u src/features/trip/TripMap.tsx public/assets
git commit -m "feat: replace tile map with Baidu route actions"
```

---

### Task 3: Acquire, verify, optimize, and display nine real photos

**Files:**

- Create: `public/images/stops/01-morning-tea.webp`
- Create: `public/images/stops/02-chen-clan-academy.webp`
- Create: `public/images/stops/03-lychee-bay.webp`
- Create: `public/images/stops/04-cantonese-opera.webp`
- Create: `public/images/stops/05-xiguan-snacks.webp`
- Create: `public/images/stops/06-shamian.webp`
- Create: `public/images/stops/07-beijing-road.webp`
- Create: `public/images/stops/08-big-buddha-temple.webp`
- Create: `public/images/stops/09-pearl-river-night.webp`
- Create: `src/features/trip/StopPhoto.tsx`
- Create: `tests/photo-assets.test.mjs`
- Modify: `src/data/itinerary.ts`
- Modify: `src/features/trip/TripPlanner.tsx`
- Modify: `tests/trip-components.test.tsx`
- Modify: `tests/pages-artifact.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add failing photo-data and component tests**

In `tests/trip-components.test.tsx`, import `StopPhoto` and add:

```tsx
describe("StopPhoto", () => {
  const photo = {
    src: "images/stops/02-chen-clan-academy.webp",
    alt: "陈家祠屋脊与院落",
    author: "Verified Commons author",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
    license: "CC BY-SA 4.0",
  };

  it("renders a local lazy image and visible credit link", () => {
    render(<StopPhoto photo={photo} title="陈家祠" priority={false} />);
    const image = screen.getByRole("img", { name: photo.alt });
    expect(image).toHaveAttribute("src", photo.src);
    expect(image).toHaveAttribute("loading", "lazy");
    expect(screen.getByRole("link", { name: /图片来源/ })).toHaveAttribute(
      "href",
      photo.sourceUrl,
    );
    expect(screen.getByText(/CC BY-SA 4.0/)).toBeInTheDocument();
  });

  it("shows a readable fallback when the local file fails", () => {
    render(<StopPhoto photo={photo} title="陈家祠" priority={false} />);
    fireEvent.error(screen.getByRole("img", { name: photo.alt }));
    expect(screen.getByRole("img", { name: "陈家祠照片暂不可用" })).toBeInTheDocument();
  });
});

describe("photo metadata", () => {
  it("covers exactly the nine confirmed real-photo slots", () => {
    const photoStops = itineraryStops.filter((stop) => stop.photo);
    expect(photoStops.map((stop) => stop.id)).toEqual([
      "tea",
      "chen-clan",
      "pantang",
      "yongqing",
      "snacks",
      "shamian",
      "beijing-road",
      "dinner",
      "cruise",
    ]);
    for (const stop of photoStops) {
      expect(stop.photo?.src).toMatch(/^images\/stops\/\d{2}-[a-z-]+\.webp$/);
      expect(stop.photo?.alt.length).toBeGreaterThan(6);
      expect(stop.photo?.author.length).toBeGreaterThan(1);
      expect(stop.photo?.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      expect(stop.photo?.license).toMatch(/^(Public domain|CC BY(?:-SA)? \d\.\d)$/);
    }
  });
});
```

The `Example.jpg` fixture is only isolated test data for component behavior; production itinerary data must contain the actual selected file pages and authors.

- [ ] **Step 2: Add a failing asset-integrity test**

Create `tests/photo-assets.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const files = [
  "01-morning-tea.webp",
  "02-chen-clan-academy.webp",
  "03-lychee-bay.webp",
  "04-cantonese-opera.webp",
  "05-xiguan-snacks.webp",
  "06-shamian.webp",
  "07-beijing-road.webp",
  "08-big-buddha-temple.webp",
  "09-pearl-river-night.webp",
];

test("ships nine optimized local WebP photos", async () => {
  for (const file of files) {
    const url = new URL(`../public/images/stops/${file}`, import.meta.url);
    const [info, bytes] = await Promise.all([stat(url), readFile(url)]);
    assert.ok(info.size > 8_000, `${file} is unexpectedly empty`);
    assert.ok(info.size <= 180 * 1024, `${file} exceeds 180 KiB`);
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", `${file} is not WebP`);
  }
});
```

Add `node --test tests/photo-assets.test.mjs` to the `test` script before either production build.

- [ ] **Step 3: Run photo tests and confirm red**

```bash
npx vitest run tests/trip-components.test.tsx
node --test tests/photo-assets.test.mjs
```

Expected: missing `StopPhoto`, missing metadata, and missing asset files.

- [ ] **Step 4: Research one compliant image for each fixed slot**

For each row below, search Wikimedia Commons, open the file page, and accept the first candidate satisfying all rules. Record the exact author, canonical Commons file-page URL, and license name before downloading.

| File | Production stop | Search subject | Acceptance check |
|---|---|---|---|
| `01-morning-tea.webp` | `tea` | Guangzhou dim sum / Cantonese morning tea | Food is identifiable; no identifiable private person dominates |
| `02-chen-clan-academy.webp` | `chen-clan` | Chen Clan Ancestral Hall Guangzhou | Building or verified decoration is clearly visible |
| `03-lychee-bay.webp` | `pantang` | Lychee Bay Guangzhou / Pantang | Waterway, bridge, or street context is visible |
| `04-cantonese-opera.webp` | `yongqing` | Cantonese Opera Art Museum Guangzhou | Museum exterior/interior is verifiably the venue |
| `05-xiguan-snacks.webp` | `snacks` | Guangzhou wonton noodles / fish skin dessert | One food named in itinerary is identifiable |
| `06-shamian.webp` | `shamian` | Shamian Island Guangzhou | Historic architecture and streetscape are visible |
| `07-beijing-road.webp` | `beijing-road` | Beijing Road Guangzhou ancient road | Street or archaeological display is identifiable |
| `08-big-buddha-temple.webp` | `dinner` | Dafo Temple Guangzhou | Temple is identifiable; evening image preferred |
| `09-pearl-river-night.webp` | `cruise` | Pearl River Guangzhou Canton Tower night | River and modern skyline are both visible |

Reject a candidate unless the file page explicitly says `Public domain`, `CC BY`, or `CC BY-SA`; the original is at least 1200 px on its long edge; and the file page identifies the subject well enough to support the Chinese `alt`. Do not use search-result thumbnails, ordinary tourism sites, social platforms, or `Fair use` media.

- [ ] **Step 5: Download and optimize the verified originals**

Download originals into a temporary directory outside the repository, then create `public/images/stops/`. Convert each to WebP, resize the long edge to at most 1600 px, and reduce quality until the file is at most 180 KiB. On this macOS workspace use `sips` when it reports WebP output support; if it does not, load the bundled workspace Python/Pillow runtime and use Pillow only for the format conversion.

For every output run:

```bash
file public/images/stops/*.webp
sips -g pixelWidth -g pixelHeight public/images/stops/*.webp
du -k public/images/stops/*.webp
```

Expected: each file is WebP, both dimensions are non-zero, the larger dimension is at most 1600, and each file is at most 180 KiB.

- [ ] **Step 6: Attach exact photo metadata to itinerary stops**

Add a `photo` object to the nine table-mapped records. Use relative paths such as `images/stops/02-chen-clan-academy.webp` so both the repository-scoped Pages URL and the root-hosted Vinext build resolve correctly. Copy author and license wording from the selected Commons file page without inventing or shortening attribution.

Each production object must use the complete `StopPhoto` shape. During acquisition, map the verified record into the itinerary with all five fields populated:

```ts
const photo: StopPhoto = {
  src: outputFile.relativeWebPath,
  alt: verifiedSubject.chineseAlt,
  author: commonsFile.author,
  sourceUrl: commonsFile.canonicalFilePage,
  license: commonsFile.reuseLicense,
};
```

These names describe the verified acquisition record; they are not strings to commit. Before proceeding, run `rg -n 'Unknown|待补|待确认|Example\.jpg' src/data/itinerary.ts` and require zero matches.

- [ ] **Step 7: Implement the resilient photo component**

Create `StopPhoto.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { StopPhoto as StopPhotoData } from "../../data/types";

interface StopPhotoProps {
  photo: StopPhotoData;
  title: string;
  priority: boolean;
}

export function StopPhoto({ photo, title, priority }: StopPhotoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="stop-photo stop-photo-fallback" role="img" aria-label={`${title}照片暂不可用`}>
        <span>照片暂不可用</span><strong>{title}</strong>
      </div>
    );
  }

  return (
    <figure className="stop-photo">
      <img
        src={photo.src}
        alt={photo.alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onError={() => setFailed(true)}
      />
      <figcaption>
        <span>真实照片 · {title}</span>
        <a href={photo.sourceUrl} target="_blank" rel="noreferrer">
          图片来源：{photo.author} · {photo.license}
        </a>
      </figcaption>
    </figure>
  );
}
```

Render it once near the top of the selected stop detail whenever `selectedStop.photo` exists. Set `priority` only for `tea`; all other stop photos remain lazy.

- [ ] **Step 8: Extend Pages artifact verification**

In `tests/pages-artifact.test.mjs`, assert that all nine paths exist under `dist-pages/images/stops/` and that generated JavaScript references `images/stops/` rather than `upload.wikimedia.org`.

- [ ] **Step 9: Run focused tests and confirm green**

```bash
npx vitest run tests/trip-components.test.tsx
node --test tests/photo-assets.test.mjs
npm run build:pages
npm run test:pages
```

Expected: nine metadata records, image component behavior, local asset format/size, and Pages copying all pass.

- [ ] **Step 10: Commit Task 3**

```bash
git add public/images/stops src/data/itinerary.ts src/features/trip/StopPhoto.tsx src/features/trip/TripPlanner.tsx tests/trip-components.test.tsx tests/photo-assets.test.mjs tests/pages-artifact.test.mjs package.json
git commit -m "feat: add licensed real trip photos"
```

---

### Task 4: Split the monolithic planner into four reusable functional views

**Files:**

- Create: `src/features/trip/StopDetail.tsx`
- Create: `src/features/trip/TripViews.tsx`
- Modify: `src/features/trip/TripPlanner.tsx`
- Modify: `tests/trip-components.test.tsx`

- [ ] **Step 1: Add view-contract tests before moving markup**

Import `MapView`, `MyTripView`, `RouteView`, and `TodoView` from `TripViews`. Add a compact fixture renderer and these assertions:

```tsx
it("exposes one labeled region for each app function", () => {
  render(
    <div>
      <RouteView {...routeProps} />
      <MapView {...mapProps} />
      <TodoView {...todoProps} />
      <MyTripView {...myTripProps} />
    </div>,
  );
  expect(screen.getByRole("region", { name: "路线规划" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "地图与导航" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "行前待办" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "我的行程" })).toBeInTheDocument();
});

it("opens both Baidu place search and next-leg navigation from the map view", () => {
  render(<MapView {...mapProps} />);
  expect(screen.getByRole("link", { name: /在百度地图查看地点/ })).toHaveAttribute(
    "href",
    expect.stringContaining("api.map.baidu.com/place/search"),
  );
  expect(screen.getByRole("link", { name: /百度地图去下一站/ })).toHaveAttribute(
    "href",
    expect.stringContaining("api.map.baidu.com/direction"),
  );
});
```

Use real `itineraryStops`, `bookingItems`, `sources`, and `budgetItems` in the fixtures so no second set of trip content is introduced.

- [ ] **Step 2: Run focused tests and confirm red**

```bash
npx vitest run tests/trip-components.test.tsx
```

Expected: missing `TripViews.tsx` exports.

- [ ] **Step 3: Extract `StopDetail` without changing its content contract**

Create `StopDetail.tsx` with this interface:

```ts
interface StopDetailProps {
  stop: ItineraryStop;
  navigationUrl: string;
  priorityPhoto: boolean;
}
```

Move the existing category, time, summary, body, facts, highlights, food, comparisons, photo, and primary navigation markup into this component. The navigation button text must be `在百度地图打开 ${stop.shortTitle}`.

- [ ] **Step 4: Create the four view components**

Create `TripViews.tsx` with these exported prop contracts:

```ts
export interface RouteViewProps {
  scenario: Scenario;
  stops: ItineraryStop[];
  selectedStop: ItineraryStop;
  completedIds: string[];
  completedCount: number;
  perPersonBudget: { min: number; max: number };
  onScenarioChange: (scenario: Scenario) => void;
  onSelectStop: (id: string) => void;
  onToggleStop: (id: string) => void;
  selectedNavigationUrl: string;
}

export interface MapViewProps {
  stops: ItineraryStop[];
  selectedStop: ItineraryStop;
  nextStop: ItineraryStop;
  placeUrl: string;
  nextNavigationUrl: string;
  onSelectStop: (id: string) => void;
}

export interface TodoViewProps {
  completedIds: string[];
  onToggle: (id: string) => void;
}

export interface MyTripViewProps {
  scenario: Scenario;
  completedStops: number;
  totalStops: number;
  completedBookings: number;
  budget: ReturnType<typeof summarizeBudget>;
  onReset: () => void;
}
```

Render the roots with these exact identity pairs: `RouteView` uses `id="route"` and `aria-label="路线规划"`; `MapView` uses `id="map"` and `aria-label="地图与导航"`; `TodoView` uses `id="todo"` and `aria-label="行前待办"`; `MyTripView` uses `id="me"` and `aria-label="我的行程"`. Every root also uses `className="app-view"`. Reuse existing hero/stats/scenario/timeline markup in `RouteView`, existing checklist/hard deadlines in `TodoView`, and budget/source/footer content in `MyTripView`. `MapView` owns `RouteDiagram`, the selected station summary, and the two Baidu actions; Task 5 adds the copy-place control to this same component.

- [ ] **Step 5: Make `TripPlanner` a state coordinator**

`TripPlanner` should now calculate:

- `activeStops`
- `selectedStop`
- `nextStop`
- the origin for selected and next stop
- budget and completion counts
- scenario/checklist/timeline callbacks

Then render the four view components with the shared state. Keep `selectedId` in `TripPlanner`; when a scenario removes the selected stop, derive the first non-rail active stop and synchronize `selectedId` in an effect only when the current ID is invalid.

- [ ] **Step 6: Run component and server-render tests**

```bash
npx vitest run tests/trip-components.test.tsx
npm run build
node --test tests/rendered-html.test.mjs
```

Expected: all four functional regions render, existing itinerary content remains server-rendered, and no duplicate data source is introduced.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/features/trip/StopDetail.tsx src/features/trip/TripViews.tsx src/features/trip/TripPlanner.tsx tests/trip-components.test.tsx
git commit -m "refactor: split planner into app views"
```

---

### Task 5: Add mobile bottom navigation, hash history, clipboard fallback, and local reset

**Files:**

- Create: `src/features/trip/MobileAppShell.tsx`
- Modify: `src/features/trip/TripPlanner.tsx`
- Modify: `src/features/trip/TripViews.tsx`
- Modify: `tests/trip-components.test.tsx`
- Modify: `tests/trip-storage.test.ts`

- [ ] **Step 1: Write failing four-tab navigation tests**

Add:

```tsx
describe("MobileAppShell", () => {
  it("switches all four functions and exposes the active page", () => {
    const onChange = vi.fn();
    render(<MobileAppShell activeView="route" onChange={onChange} />);

    expect(screen.getByRole("link", { name: "路线" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("link", { name: "地图" }));
    expect(onChange).toHaveBeenCalledWith("map");
    fireEvent.click(screen.getByRole("link", { name: "待办" }));
    expect(onChange).toHaveBeenCalledWith("todo");
    fireEvent.click(screen.getByRole("link", { name: "我的" }));
    expect(onChange).toHaveBeenCalledWith("me");
  });
});

it("persists mobile view and responds to browser history", () => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "#route");
  render(<TripPlanner />);

  const mobileNav = within(screen.getByRole("navigation", { name: "手机功能导航" }));
  fireEvent.click(mobileNav.getByRole("link", { name: "地图" }));
  expect(window.location.hash).toBe("#map");
  expect(JSON.parse(window.localStorage.getItem("guangzhou-day-trip:v2") ?? "{}").activeView)
    .toBe("map");

  window.history.pushState(null, "", "#todo");
  fireEvent.popState(window);
  expect(mobileNav.getByRole("link", { name: "待办" })).toHaveAttribute("aria-current", "page");
});
```

Add `within` to the Testing Library import used by this test.

- [ ] **Step 2: Write failing reset and clipboard-fallback tests**

Add:

```tsx
it("requires confirmation before clearing local trip records", () => {
  window.localStorage.setItem("guangzhou-day-trip:v2", JSON.stringify({
    version: 2,
    scenario: "rain",
    completedStopIds: ["tea"],
    bookingIds: ["weather"],
    activeView: "me",
  }));
  vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
  const { rerender } = render(<TripPlanner />);

  fireEvent.click(screen.getByRole("button", { name: "清除本机记录" }));
  expect(window.localStorage.getItem("guangzhou-day-trip:v2")).not.toBeNull();
  rerender(<TripPlanner />);
  fireEvent.click(screen.getByRole("button", { name: "清除本机记录" }));
  expect(window.localStorage.getItem("guangzhou-day-trip:v2")).toBeNull();
});

it("shows selectable place text when clipboard permission fails", async () => {
  vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
  render(<MapView {...mapProps} />);
  fireEvent.click(screen.getByRole("button", { name: "复制地点" }));
  expect(await screen.findByText("广州 陈家祠")).toBeInTheDocument();
});
```

Initialize `navigator.clipboard` in the test when jsdom does not provide it.

- [ ] **Step 3: Run focused tests and confirm red**

```bash
npx vitest run tests/trip-components.test.tsx tests/trip-storage.test.ts
```

Expected: missing shell, active-view behavior, reset UI, and copy fallback.

- [ ] **Step 4: Implement the bottom navigation component**

Create `MobileAppShell.tsx`:

```tsx
import type { MobileView } from "../../data/types";

const views: Array<{ id: MobileView; label: string; mark: string }> = [
  { id: "route", label: "路线", mark: "线" },
  { id: "map", label: "地图", mark: "图" },
  { id: "todo", label: "待办", mark: "办" },
  { id: "me", label: "我的", mark: "我" },
];

export function MobileAppShell({
  activeView,
  onChange,
}: {
  activeView: MobileView;
  onChange: (view: MobileView) => void;
}) {
  return (
    <nav className="mobile-bottom-nav" aria-label="手机功能导航">
      {views.map((view) => (
        <a
          key={view.id}
          href={`#${view.id}`}
          aria-current={activeView === view.id ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            onChange(view.id);
          }}
        >
          <span aria-hidden="true">{view.mark}</span>
          {view.label}
        </a>
      ))}
    </nav>
  );
}
```

- [ ] **Step 5: Implement hash parsing and history synchronization**

In `TripPlanner.tsx`, add:

```ts
const mobileViews: MobileView[] = ["route", "map", "todo", "me"];

function parseViewHash(hash: string): MobileView | null {
  const value = hash.replace(/^#/, "") as MobileView;
  return mobileViews.includes(value) ? value : null;
}
```

On mount, if the current hash is valid, store it as `activeView`; otherwise call `history.replaceState` with the persisted view. Listen to both `popstate` and `hashchange`, update local state only when the parsed view is valid and different, and remove both listeners on cleanup.

The tab callback must update `TripState.activeView` and then use `history.pushState(null, "", `#${view}`)` only when the hash differs. It must not dispatch a synthetic history event, because the React state update already changes the current view.

Apply `is-active` and `aria-hidden` to each `.app-view` from `tripState.activeView`. `aria-hidden` is only needed on inactive views; CSS in Task 6 controls mobile visibility while desktop overrides all views to visible.

- [ ] **Step 6: Implement copy-place success/failure states**

In `MapView`, keep a `copyStatus: "idle" | "copied" | "manual"`. Copy `广州 ${selectedStop.placeName}`. On success show `已复制地点`; on rejection show a selectable `<code>` containing the exact text and label it `手动复制地点`.

- [ ] **Step 7: Implement confirmed local reset**

Wire the `MyTripView` button to:

```ts
const resetLocalTrip = useCallback(() => {
  if (!window.confirm("确定清除当前设备上的模式、打卡、待办和最近功能吗？")) return;
  resetTripState();
  window.history.replaceState(null, "", "#route");
}, []);
```

The reset must not reload the page or remove any content/assets.

- [ ] **Step 8: Run focused tests and confirm green**

```bash
npx vitest run tests/trip-components.test.tsx tests/trip-storage.test.ts
```

Expected: tab state, URL history, clipboard failure, and confirmed reset all pass.

- [ ] **Step 9: Commit Task 5**

```bash
git add src/features/trip/MobileAppShell.tsx src/features/trip/TripPlanner.tsx src/features/trip/TripViews.tsx tests/trip-components.test.tsx tests/trip-storage.test.ts
git commit -m "feat: add mobile trip app navigation"
```

---

### Task 6: Finish the responsive app shell, photos, and accessibility styling

**Files:**

- Modify: `app/globals.css`
- Modify: `src/features/trip/TripViews.tsx`
- Modify: `src/features/trip/TripPlanner.tsx`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/trip-components.test.tsx`

- [ ] **Step 1: Add structural accessibility assertions**

Extend `tests/trip-components.test.tsx` and `tests/rendered-html.test.mjs` to require:

```tsx
const mobileNav = within(screen.getByRole("navigation", { name: "手机功能导航" }));
expect(mobileNav.getAllByRole("link")).toHaveLength(4);
expect(mobileNav.getByRole("link", { name: "路线" })).toBeInTheDocument();
expect(mobileNav.getByRole("link", { name: "地图" })).toBeInTheDocument();
expect(mobileNav.getByRole("link", { name: "待办" })).toBeInTheDocument();
expect(mobileNav.getByRole("link", { name: "我的" })).toBeInTheDocument();
expect(screen.getByRole("region", { name: "地图与导航" })).toHaveTextContent("游览顺序示意");
expect(screen.getByText("不登录、不定位、不上传数据")).toBeInTheDocument();
```

In the server HTML test require `路线规划`, `地图与导航`, `行前待办`, and `我的行程`, and forbid `OpenStreetMap`, `Leaflet`, and `高德`.

- [ ] **Step 2: Run focused tests and confirm red for any missing labels**

```bash
npx vitest run tests/trip-components.test.tsx
npm run build
node --test tests/rendered-html.test.mjs
```

Expected: any remaining missing privacy or region label is exposed before styling.

- [ ] **Step 3: Replace map CSS with route-diagram CSS**

Delete all selectors containing `.map-frame`, `.leaflet-`, `.route-marker`, or `.route-fallback`. Add styles for:

- `.route-diagram`
- `.route-diagram-heading`
- `.route-diagram ol`, `li`, and connecting pseudo-elements
- `.route-diagram button`
- `.route-diagram button[aria-current="location"]`
- `.route-diagram-number`
- `.route-diagram-copy`

Use paper/ink/red design tokens already defined. Use CSS borders and gradients only; do not add authored SVG.

- [ ] **Step 4: Add photo-card styling and stable failure dimensions**

Style `.stop-photo` with `aspect-ratio: 3 / 2`, `overflow: hidden`, and a minimum height. Apply `object-fit: cover` to the image. Keep credits on an opaque paper strip, allow text wrapping, and give the credit link at least 44 px of clickable height. `.stop-photo-fallback` must occupy the same aspect ratio and visibly state that the photo is unavailable.

- [ ] **Step 5: Add the desktop behavior**

Above 760px:

- All `.app-view` sections display in document order, even when not the persisted active view.
- `.mobile-bottom-nav` is `display: none`.
- The regular header anchors remain visible and target `#route`, `#map`, `#todo`, and `#me`.
- The fixed next-stop bar stays available and all desktop content remains scrollable.

Do not use `aria-hidden` on desktop sections. Determine desktop state with CSS visibility plus a `matchMedia("(max-width: 760px)")` subscription in `TripPlanner` so `aria-hidden` is applied only on mobile.

- [ ] **Step 6: Add the mobile app behavior**

At `max-width: 760px`:

- Only `.app-view.is-active` displays.
- `.mobile-bottom-nav` is fixed to the bottom, includes `padding-bottom: env(safe-area-inset-bottom)`, and has four equal columns.
- Each tab is at least 56 px tall; its text and mark remain visible.
- `body` and the active view have bottom padding greater than the combined bottom-nav and next-stop-bar height.
- The next-stop bar sits above the bottom navigation and does not cover its targets.
- Hero content is compact enough that date, scenario, current stop, and next-stop action are recognizable within the first two mobile screens.
- Route diagram buttons, copy control, booking actions, reset, and credits are at least 44×44 px.
- No container exceeds the viewport width at 320 px.

Use `@media (prefers-reduced-motion: reduce)` to disable functional-view transition movement.

- [ ] **Step 7: Add an app-style top bar and privacy statement**

On mobile, show a compact sticky top bar with the trip title, date, and current scenario. On desktop keep the current site header. Add the exact privacy sentence `不登录、不定位、不上传数据` to `MyTripView` near the reset action.

- [ ] **Step 8: Run lint, component, and render tests**

```bash
npm run lint
npx vitest run tests/trip-components.test.tsx
npm run build
node --test tests/rendered-html.test.mjs
```

Expected: no lint errors, every semantic label is present, server HTML retains all four views, and no legacy map wording remains.

- [ ] **Step 9: Commit Task 6**

```bash
git add app/globals.css src/features/trip/TripViews.tsx src/features/trip/TripPlanner.tsx tests/rendered-html.test.mjs tests/trip-components.test.tsx
git commit -m "style: finish responsive mobile trip shell"
```

---

### Task 7: Verify both builds, publish GitHub Pages, and perform real mobile QA

**Files:**

- Modify if verification exposes a real defect: only the smallest affected source/test file
- No planned source file is created in this task

- [ ] **Step 1: Run the complete local verification suite**

```bash
npm run lint
npm test
```

Expected: Vitest, photo-asset tests, Vinext production build, rendered HTML test, Vite Pages build, and Pages artifact test all exit 0.

- [ ] **Step 2: Search the repository and production artifact for forbidden dependencies**

```bash
rg -n "leaflet|tile\.openstreetmap\.org|uri\.amap\.com|在高德|高德导航" src app static-site tests package.json package-lock.json dist-pages
rg -n "upload\.wikimedia\.org|commons\.wikimedia\.org/wiki/Special:Redirect/file" src app static-site dist-pages
```

Expected: both commands return no matches except deliberate negative-test regexes in test files. Inspect those test-only matches; production source and artifacts must have none.

- [ ] **Step 3: Check image and bundle budgets**

```bash
du -k public/images/stops/*.webp
du -sh dist-pages
```

Expected: every image is at most 180 KiB. Record the total Pages artifact size in the task notes; if one image exceeds the limit, recompress that image and rerun `npm test`.

- [ ] **Step 4: Start the repository-scoped Pages build locally**

Run in a persistent terminal:

```bash
npm run build:pages
npx vite preview --outDir dist-pages --host 127.0.0.1
```

Open the reported local URL with the in-app browser. If Vite serves at root, visit `/guangzhou-day-trip-0820/` so the production base path is exercised.

- [ ] **Step 5: Perform mobile viewport QA at 375×812 and 390×844**

At both sizes verify:

1. Route, map, todo, and my tabs each reveal only their main window.
2. Browser back/forward changes the tab and URL hash.
3. Refresh restores the hash/persisted tab and completed checklist state.
4. Rain removes Pantang; delay removes Pantang and Shamian; selected station remains valid.
5. The diagram has no loading state and every visible station is clickable.
6. The nine photos load from `/guangzhou-day-trip-0820/images/stops/` and credits open their Commons file pages.
7. A Baidu place link contains `api.map.baidu.com/place/search`; a navigation link contains `api.map.baidu.com/direction`, origin, destination, region, and mode.
8. Rejecting clipboard permission leaves manual copy text visible.
9. Canceling reset preserves state; confirming reset returns to normal/route and clears local progress.
10. There is no horizontal scroll; bottom controls do not obscure the last content; every tap target is at least 44 px.

- [ ] **Step 6: Perform desktop QA at 1440×900**

Verify all four sections are visible in one long page, header anchors scroll to each section, bottom mobile navigation is absent, photos do not stretch, route selection updates the detail, and the next-stop bar remains usable.

- [ ] **Step 7: Verify offline-after-load behavior**

After loading the local page once, use browser network controls to go offline without reloading. Verify the already loaded route diagram, trip text, state, budget, checklist, and photos remain readable. Restore network before link/deployment checks. Do not claim cold-start offline support.

- [ ] **Step 8: Commit any verification-only fix and rerun the full suite**

If QA found a real defect, write a failing focused test, implement the smallest fix, run that focused test, then rerun:

```bash
npm run lint
npm test
```

Commit only the verified fix with a specific `fix:` message. If no defect was found, do not create an empty commit.

- [ ] **Step 9: Push the verified branch to GitHub `main`**

Inspect `git status --short` and `git log --oneline --decorate -8`; require a clean worktree and the expected task commits. Then push the verified feature head to the existing public repository:

```bash
git push origin HEAD:main
```

This external write is within the already confirmed migration/publishing scope. Do not force-push.

- [ ] **Step 10: Wait for GitHub Pages deployment and verify production**

Use `gh run list` and `gh run watch` for the new Pages workflow run. Require success, then open:

```text
https://z-xq7.github.io/guangzhou-day-trip-0820/
```

Repeat the essential 390×844 checks on production: four tabs, no blank/loading map, two Baidu URL types, nine same-origin photos, credits, state restore, and no horizontal scrolling. In browser network inspection confirm there are no requests to `openstreetmap.org`, Leaflet assets, or remote image hosts.

- [ ] **Step 11: Run and record production Lighthouse checks**

Run Lighthouse against the production URL in mobile mode with Performance and Accessibility categories. Require Accessibility ≥95 and target Performance ≥85. If Accessibility is below 95, treat it as a release defect and fix it before handoff. If Performance is below 85, inspect the audit; fix local-image sizing, render-blocking resources, or layout shift when they are the cause, rerun the complete suite, republish, and remeasure.

- [ ] **Step 12: Final handoff**

Report the production URL, deployment run result, test counts, Lighthouse scores, exact map architecture (`本地路线示意 + 百度地图外链`), photo count/license strategy, and any remaining date-dependent booking data that still requires the planned August 6 / August 13 / August 19 checks.
