# Guangzhou Discovery Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有广州情侣一日游网站中新增一个可搜索、筛选、收藏和静态地图联动的「发现广州」功能，收录 21 个景点与 9 家餐饮，并提供真实授权照片、透明评分、地图位置和可追溯介绍。

**Architecture:** 保留 `TripPlanner` 作为 URL hash 与顶层状态的唯一所有者，把发现数据、筛选逻辑、收藏存储、图片、卡片和静态地图拆入独立 `src/features/discovery/` 边界。全部地点、照片署名、来源、评分维度和地图坐标由结构化数据驱动；运行时不请求地图或图片服务，精确地点只通过百度地图外链打开。

**Tech Stack:** React 19、TypeScript 5.9、Vinext/Next、Vite、Vitest、Testing Library、Sharp、CSS、GitHub Pages、Sites 兼容构建。

## Global Constraints

- 首版必须恰好包含 30 个地点：21 个景点、9 家餐饮。
- 手机底部导航为 `路线｜发现｜地图｜待办｜我的`；`#discover` 与 `#discover/<id>` 支持直达、后退和刷新。
- 站内推荐分由类型专属五项维度计算为 1.0–5.0，不得伪装成用户评分；平台分只有公开可核验时才显示。
- 地图是本地静态图片/图片层，不增加地图 SDK、API Key、位置权限、服务端或数据库。
- 真实照片必须本地 WebP 化并带作者、原始文件页、许可链接和修改说明；餐饮示意图必须明确“非该门店实拍”。
- 所有设备状态仅保存到带版本号的 `localStorage`，遇到 `SecurityError` 降级为会话内存。
- GitHub Pages 是对外生产目标；`.openai/hosting.json` 与 Sites/Vinext 构建保持可用。
- 目标视口 320×568、375×812、390×844、1440×900 无横向滚动，触控目标至少 44px。
- 最终 Lighthouse Accessibility ≥95、Performance ≥85；断网后站内文字、照片、筛选、收藏和静态地图仍可用。

---

## File Structure

### New files

- `src/features/discovery/discovery-types.ts`：发现地点、评分、筛选、图片与来源类型。
- `src/data/discovery.ts`：30 个地点的唯一结构化数据源和精选位 ID。
- `src/features/discovery/discovery-logic.ts`：评分、验证、搜索、筛选、排序、hash 编解码和百度链接。
- `src/features/discovery/discovery-storage.ts`：想去清单的版本化本地持久化与内存降级。
- `src/features/discovery/DiscoveryPhoto.tsx`：实景图、错误占位、逐图署名。
- `src/features/discovery/DiscoveryCard.tsx`：折叠/展开地点卡片与操作。
- `src/features/discovery/DiscoveryMap.tsx`：静态地图、编号点位和密集区放大图。
- `src/features/discovery/DiscoveryView.tsx`：导览头图、搜索筛选、排序、地图和列表编排。
- `public/images/discovery/01-*.webp` … `30-*.webp`：30 张授权实景/菜品照片。
- `public/images/discovery/guangzhou-discovery-map.webp`：本地广州位置示意底图。
- `public/images/discovery/credits.json`：与 30 张图片一一对应的机器可检署名清单。
- `tests/discovery-data.test.ts`：数据完整性、评分和图片署名一一对应测试。
- `tests/discovery-logic.test.ts`：筛选、排序、hash 和百度 URL 测试。
- `tests/discovery-storage.test.ts`：收藏持久化、迁移与降级测试。
- `tests/discovery-components.test.tsx`：卡片、地图与发现页交互测试。
- `tests/discovery-assets.test.mjs`：30 张 WebP、静态地图和署名清单测试。
- `public/og.png`：与最终网页一致的社交分享图。

### Modified files

- `src/data/types.ts`：`MobileView` 新增 `discover`，`TripState` 升级至 v3 并包含 `wishlistPlaceIds`。
- `src/features/trip/trip-storage.ts`：v2→v3 迁移和重置逻辑。
- `src/features/trip/MobileAppShell.tsx`：增加「发现」标签。
- `src/features/trip/TripPlanner.tsx`：顶层发现状态、hash 所有权、详情直达与 `DiscoveryView` 接入。
- `src/features/trip/TripViews.tsx`：桌面导航增加发现入口，我的页面增加想去摘要。
- `app/globals.css`：发现页移动/桌面布局、地图点位、卡片和离线占位样式。
- `app/layout.tsx`：更新站点说明和社交分享元数据。
- `static-site/index.html`：同步标题、描述和静态 Open Graph 标签。
- `tests/trip-storage.test.ts`：v3 存储与 v2 迁移回归。
- `tests/trip-components.test.tsx`：五标签导航、hash 和重置回归。
- `tests/pages-artifact.test.mjs`：发现资源、静态地图和无远程运行时图片断言。
- `tests/rendered-html.test.mjs`：SSR 标题和发现页静态文本断言。

---

### Task 1: Discovery domain model, score calculation, and 30-place data

**Files:**
- Create: `src/features/discovery/discovery-types.ts`
- Create: `src/data/discovery.ts`
- Create: `tests/discovery-data.test.ts`

**Interfaces:**
- Produces: `DiscoveryPlace`, `EditorialDimensions`, `DiscoveryFilters`, `VerifiedPlatformRating`, `LicensedDiscoveryPhoto`, `discoveryPlaces`, `featuredDiscoveryIds`, `calculateEditorialScore(place)`, `validateDiscoveryPlaces(places)`.
- Consumes: no discovery interfaces from earlier tasks.

- [ ] **Step 1: Write the failing data and score tests**

Create `tests/discovery-data.test.ts` with exact invariants:

```ts
import { describe, expect, it } from "vitest";
import { discoveryPlaces, featuredDiscoveryIds } from "../src/data/discovery";
import {
  calculateEditorialScore,
  validateDiscoveryPlaces,
} from "../src/features/discovery/discovery-logic";

describe("discovery data", () => {
  it("contains exactly 21 attractions and 9 food places with continuous indices", () => {
    expect(discoveryPlaces).toHaveLength(30);
    expect(discoveryPlaces.filter((place) => place.kind === "attraction")).toHaveLength(21);
    expect(discoveryPlaces.filter((place) => place.kind === "food")).toHaveLength(9);
    expect(discoveryPlaces.map((place) => place.index)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
  });

  it("has unique IDs, valid coordinates, complete licenses, sources, and nearby references", () => {
    expect(validateDiscoveryPlaces(discoveryPlaces)).toEqual([]);
  });

  it("calculates a one-decimal type-specific score instead of trusting a stored total", () => {
    const chenClan = discoveryPlaces.find((place) => place.id === "chen-clan-academy")!;
    expect(calculateEditorialScore(chenClan)).toBe(4.8);
    expect(calculateEditorialScore(chenClan)).toBeGreaterThanOrEqual(1);
    expect(calculateEditorialScore(chenClan)).toBeLessThanOrEqual(5);
  });

  it("uses six valid featured IDs", () => {
    expect(featuredDiscoveryIds).toHaveLength(6);
    expect(featuredDiscoveryIds.every((id) => discoveryPlaces.some((place) => place.id === id))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npx vitest run tests/discovery-data.test.ts`  
Expected: FAIL because discovery modules do not exist.

- [ ] **Step 3: Define exact domain types**

Create `discovery-types.ts` with:

```ts
export type DiscoveryKind = "attraction" | "food";
export type PriceLevel = "free" | "low" | "medium" | "high";
export type IndoorOutdoor = "indoor" | "outdoor" | "mixed";
export type DiscoveryAudience = "couple" | "family" | "elder" | "rain" | "night";
export type DiscoverySort = "editorial" | "couple" | "family" | "duration" | "budget";

export interface EditorialDimensions {
  distinctiveness: number;
  completeness: number;
  coupleAppeal: number;
  convenience: number;
  value: number;
}

export interface LicensedDiscoveryPhoto {
  src: string;
  alt: string;
  caption: string;
  author: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  modifications: string;
  isRepresentativeOnly?: boolean;
}

export interface SourceRef {
  title: string;
  publisher: string;
  url: string;
  verifiedAt: string;
}

export interface VerifiedPlatformRating {
  platform: string;
  score: number;
  scale: number;
  url: string;
  verifiedAt: string;
}

export interface DiscoveryPlace {
  id: string;
  index: number;
  kind: DiscoveryKind;
  name: string;
  aliases: string[];
  district: string;
  coordinate: { lat: number; lng: number };
  mapLabelOffset?: { x: number; y: number };
  summary: string;
  description: string;
  themes: string[];
  recommendedFor: DiscoveryAudience[];
  audienceScores: { couple: number; family: number; elder: number; rain: number };
  indoorOutdoor: IndoorOutdoor;
  bestTime: string;
  durationMinutes: [number, number];
  budgetPerPerson: [number, number];
  priceLevel: PriceLevel;
  highlights: string[];
  transit: string;
  opening: string;
  nearbyPlaceIds: string[];
  baiduPlaceName: string;
  photo: LicensedDiscoveryPhoto;
  editorialDimensions: EditorialDimensions;
  platformRating?: VerifiedPlatformRating;
  sources: SourceRef[];
  verifiedAt: string;
}

export interface DiscoveryFilters {
  query: string;
  kind: "all" | DiscoveryKind;
  themes: string[];
  districts: string[];
  audiences: DiscoveryAudience[];
  priceLevels: PriceLevel[];
  sort: DiscoverySort;
}
```

- [ ] **Step 4: Implement score and validation functions**

Create the initial `discovery-logic.ts` exports:

```ts
import type { DiscoveryPlace, EditorialDimensions } from "./discovery-types";

const SCORE_WEIGHTS: Record<keyof EditorialDimensions, number> = {
  distinctiveness: 0.3,
  completeness: 0.25,
  coupleAppeal: 0.2,
  convenience: 0.15,
  value: 0.1,
};

export function calculateEditorialScore(place: DiscoveryPlace) {
  const total = Object.entries(SCORE_WEIGHTS).reduce(
    (sum, [key, weight]) => sum + place.editorialDimensions[key as keyof EditorialDimensions] * weight,
    0,
  );
  return Math.round(total * 10) / 10;
}

export function validateDiscoveryPlaces(places: DiscoveryPlace[]) {
  const errors: string[] = [];
  const ids = new Set(places.map((place) => place.id));
  if (places.length !== 30) errors.push("expected exactly 30 places");
  if (ids.size !== places.length) errors.push("place IDs must be unique");
  places.forEach((place, arrayIndex) => {
    if (place.index !== arrayIndex + 1) errors.push(`${place.id}: invalid index`);
    if (Math.abs(place.coordinate.lat) > 90 || Math.abs(place.coordinate.lng) > 180) errors.push(`${place.id}: invalid coordinate`);
    if (!place.photo.author || !place.photo.sourceUrl.startsWith("https://") || !place.photo.licenseUrl.startsWith("https://") || !place.photo.modifications) errors.push(`${place.id}: incomplete photo credit`);
    if (!place.sources.length || place.sources.some((source) => !source.url.startsWith("https://"))) errors.push(`${place.id}: invalid sources`);
    if (place.nearbyPlaceIds.some((id) => !ids.has(id))) errors.push(`${place.id}: unknown nearby place`);
    if (Object.values(place.editorialDimensions).some((score) => score < 1 || score > 5)) errors.push(`${place.id}: invalid score dimension`);
  });
  return errors;
}
```

- [ ] **Step 5: Populate the exact 30 places**

Create `src/data/discovery.ts` with the 30 names and order from the approved spec. Each record must contain concrete copy, verified source URLs/dates, realistic Guangzhou coordinates, category-specific dimensions, four audience scores, duration and budget tuples. Set:

```ts
export const featuredDiscoveryIds = [
  "chen-clan-academy",
  "shamian",
  "canton-tower",
  "pearl-river-cruise",
  "guangzhou-restaurant-wenchang",
  "chimelong-resort",
];
```

Use the exact filenames `01-chen-clan-academy.webp` through `30-yinji-rice-roll.webp` for every `photo.src`; keep the numeric prefix aligned with `place.index`. When an asset is a true food photograph but not that store's own product, set `isRepresentativeOnly: true` and caption it “菜品示意，非该门店实拍”。 Do not set `platformRating` unless the exact public rating page, value and date have been manually verified.

- [ ] **Step 6: Run tests and typecheck through build**

Run: `npx vitest run tests/discovery-data.test.ts && npm run build`  
Expected: PASS; Vinext build exits 0.

- [ ] **Step 7: Commit the domain slice**

```bash
git add src/features/discovery/discovery-types.ts src/features/discovery/discovery-logic.ts src/data/discovery.ts tests/discovery-data.test.ts
git commit -m "feat: add Guangzhou discovery catalog"
```

---

### Task 2: Search, filters, sorting, hash state, and Baidu place links

**Files:**
- Modify: `src/features/discovery/discovery-logic.ts`
- Create: `tests/discovery-logic.test.ts`

**Interfaces:**
- Consumes: `DiscoveryPlace`, `DiscoveryFilters`, `discoveryPlaces` from Task 1.
- Produces: `defaultDiscoveryFilters`, `filterDiscoveryPlaces`, `sortDiscoveryPlaces`, `encodeDiscoveryHash`, `parseDiscoveryHash`, `buildDiscoveryBaiduUrl`.

- [ ] **Step 1: Write failing logic tests**

Create tests covering normalized Chinese/English search, AND-across-groups/OR-within-group filtering, category-specific sorting, empty results, malformed hashes and URL encoding:

```ts
it("searches aliases, districts, themes, highlights, and food names", () => {
  expect(filterDiscoveryPlaces(discoveryPlaces, { ...defaultDiscoveryFilters, query: "双皮奶" }).map((p) => p.id)).toEqual(["nanxin-dessert"]);
  expect(filterDiscoveryPlaces(discoveryPlaces, { ...defaultDiscoveryFilters, query: "xiguan" }).some((p) => p.id === "yongqingfang")).toBe(true);
});

it("combines groups with AND and selected values inside a group with OR", () => {
  const result = filterDiscoveryPlaces(discoveryPlaces, {
    ...defaultDiscoveryFilters,
    kind: "attraction",
    districts: ["荔湾", "越秀"],
    audiences: ["rain"],
    priceLevels: ["free", "low"],
  });
  expect(result.every((p) => p.kind === "attraction")).toBe(true);
  expect(result.every((p) => ["荔湾", "越秀"].includes(p.district))).toBe(true);
});

it("round-trips a discovery detail and filters through the hash", () => {
  const hash = encodeDiscoveryHash({ placeId: "chen-clan-academy", filters: { ...defaultDiscoveryFilters, query: "岭南", themes: ["岭南文化"] } });
  expect(parseDiscoveryHash(hash)).toMatchObject({ placeId: "chen-clan-academy", filters: { query: "岭南", themes: ["岭南文化"] } });
});

it("rejects an unknown detail id and malformed percent encoding", () => {
  expect(parseDiscoveryHash("#discover/not-a-place")).toMatchObject({ placeId: null });
  expect(parseDiscoveryHash("#discover/%E0%A4%A")).toBeNull();
});

it("builds an encoded Baidu place search without coordinates", () => {
  const url = new URL(buildDiscoveryBaiduUrl("陈家祠"));
  expect(url.hostname).toBe("api.map.baidu.com");
  expect(url.searchParams.get("query")).toBe("广州 陈家祠");
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/discovery-logic.test.ts`  
Expected: FAIL because the new exports are missing.

- [ ] **Step 3: Implement pure filter and sort functions**

Use a single normalized haystack per place:

```ts
const normalized = (value: string) => value.trim().toLocaleLowerCase("zh-CN").replace(/\s+/g, " ");

function matchesOne<T extends string>(selected: T[], values: readonly T[]) {
  return selected.length === 0 || selected.some((value) => values.includes(value));
}

export function filterDiscoveryPlaces(places: DiscoveryPlace[], filters: DiscoveryFilters) {
  const query = normalized(filters.query);
  return places.filter((place) => {
    const haystack = normalized([
      place.name, ...place.aliases, place.district, ...place.themes,
      ...place.highlights, place.summary,
    ].join(" "));
    return (!query || haystack.includes(query))
      && (filters.kind === "all" || place.kind === filters.kind)
      && matchesOne(filters.districts, [place.district])
      && matchesOne(filters.themes, place.themes)
      && matchesOne(filters.audiences, place.recommendedFor)
      && matchesOne(filters.priceLevels, [place.priceLevel]);
  });
}
```

Sort a copied array. Editorial sorting compares `calculateEditorialScore`; couple/family use `audienceScores`; duration and budget use tuple averages; ties use `index`.

- [ ] **Step 4: Implement resilient hash codec and Baidu URL**

Use `#discover` or `#discover/<encoded-id>?q=&kind=&themes=...`; parse only known enum values and known place IDs, return `null` on decode failure, and never throw. `buildDiscoveryBaiduUrl(placeName)` must use `URLSearchParams` with `query: 广州 ${placeName}`, `region: 广州`, `output: html`, `src: webapp.Z-xq7.guangzhou-day-trip`.

- [ ] **Step 5: Run focused and existing logic tests**

Run: `npx vitest run tests/discovery-logic.test.ts tests/discovery-data.test.ts tests/trip-logic.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/discovery/discovery-logic.ts tests/discovery-logic.test.ts
git commit -m "feat: add discovery search and URL state"
```

---

### Task 3: Version 3 trip state and resilient wishlist storage

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/features/trip/trip-storage.ts`
- Modify: `tests/trip-storage.test.ts`
- Create: `src/features/discovery/discovery-storage.ts`
- Create: `tests/discovery-storage.test.ts`

**Interfaces:**
- Consumes: known discovery IDs from `discoveryPlaces`.
- Produces: `TripState.version = 3`, `wishlistPlaceIds`, `toggleWishlistPlace(id)`, `clearWishlist()`, and v1/v2 migration.

- [ ] **Step 1: Write failing v3 migration and wishlist tests**

Add exact expectations:

```ts
it("migrates version 2 and preserves all trip progress", () => {
  storage.setItem(V2_STORAGE_KEY, JSON.stringify({
    version: 2, scenario: "rain", completedStopIds: ["tea"],
    bookingIds: ["cruise-ticket"], activeView: "map",
  }));
  expect(loadTripState(storage)).toEqual({
    version: 3, scenario: "rain", completedStopIds: ["tea"],
    bookingIds: ["cruise-ticket"], activeView: "map", wishlistPlaceIds: [],
  });
});

it("rejects unknown wishlist IDs while retaining known IDs", () => {
  storage.setItem(STORAGE_KEY, JSON.stringify({ ...defaultTripState, wishlistPlaceIds: ["shamian", "unknown"] }));
  expect(loadTripState(storage).wishlistPlaceIds).toEqual(["shamian"]);
});
```

In `discovery-storage.test.ts`, mock `window.localStorage.setItem` throwing `SecurityError`; call `toggleWishlistPlace("shamian")` twice and assert the first snapshot contains the ID and the second removes it without throwing.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/trip-storage.test.ts tests/discovery-storage.test.ts`  
Expected: FAIL because v3 and wishlist do not exist.

- [ ] **Step 3: Upgrade storage without losing v1/v2 data**

Set:

```ts
export const STORAGE_KEY = "guangzhou-day-trip:v3";
export const V2_STORAGE_KEY = "guangzhou-day-trip:v2";
export const LEGACY_STORAGE_KEY = "guangzhou-day-trip:v1";
```

Update `TripState` to:

```ts
export interface TripState {
  version: 3;
  scenario: Scenario;
  completedStopIds: string[];
  bookingIds: string[];
  wishlistPlaceIds: string[];
  activeView: MobileView;
}
```

Load v3 first, then v2, then v1. Filter wishlist entries through a `knownDiscoveryIds` set. Clear all three keys during reset. Preserve the existing cached snapshot and memory-fallback semantics.

- [ ] **Step 4: Add the small wishlist facade**

`discovery-storage.ts` exports:

```ts
export function toggleWishlistPlace(id: string) {
  if (!knownDiscoveryIds.has(id)) return;
  updateTripState((state) => ({
    ...state,
    wishlistPlaceIds: state.wishlistPlaceIds.includes(id)
      ? state.wishlistPlaceIds.filter((value) => value !== id)
      : [...state.wishlistPlaceIds, id],
  }));
}

export function clearWishlist() {
  updateTripState((state) => ({ ...state, wishlistPlaceIds: [] }));
}
```

Test `clearWishlist()` from a state containing one attraction and one food ID and assert the resulting snapshot is empty; the existing itinerary completion and booking arrays must remain unchanged.

- [ ] **Step 5: Run storage tests**

Run: `npx vitest run tests/trip-storage.test.ts tests/discovery-storage.test.ts`  
Expected: PASS, including `SecurityError` session-memory behavior.

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/features/trip/trip-storage.ts src/features/discovery/discovery-storage.ts tests/trip-storage.test.ts tests/discovery-storage.test.ts
git commit -m "feat: persist discovery wishlist"
```

---

### Task 4: Acquire and verify real photos plus the local static map

**Files:**
- Create: `public/images/discovery/*.webp`
- Create: `public/images/discovery/guangzhou-discovery-map.webp`
- Create: `public/images/discovery/credits.json`
- Create: `tests/discovery-assets.test.mjs`
- Modify: `tests/discovery-data.test.ts`
- Modify: `tests/photo-assets.test.mjs`

**Interfaces:**
- Consumes: `photo.src` and credits from `discoveryPlaces`.
- Produces: 30 decodable 3:2 WebP assets, one legible map image, and exact license metadata.

- [ ] **Step 1: Write failing asset tests**

Create a Node test that reads `public/images/discovery/credits.json`, then for each of 30 entries asserts:

```js
assert.equal(credits.length, 30);
assert.equal(new Set(credits.map((credit) => credit.placeId)).size, 30);
assert.ok(credit.sourceUrl.startsWith("https://"));
assert.ok(credit.licenseUrl.startsWith("https://"));
assert.ok(credit.modifications.length > 0);
assert.ok(info.size > 8_000 && info.size <= 280 * 1024);
assert.equal(metadata.format, "webp");
assert.ok(metadata.width >= 900 && metadata.height >= 600);
assert.ok(Math.abs(metadata.width / metadata.height - 1.5) <= 0.01);
```

For the map assert WebP decoding, width ≥1200, height ≥800, size ≤500 KiB. Assert the existing nine stop assets still pass their own limits.

- [ ] **Step 2: Verify RED because assets are absent**

Run: `node --test tests/discovery-assets.test.mjs`  
Expected: FAIL with missing `credits.json` or image files.

- [ ] **Step 3: Select and record 30 licensed source images**

For each place, use Wikimedia Commons file pages where possible. Record in `credits.json`:

```json
{
  "placeId": "chen-clan-academy",
  "file": "01-chen-clan-academy.webp",
  "author": "钉钉",
  "sourceUrl": "https://commons.wikimedia.org/wiki/File:Chen_Clan_Ancestral_Hall,_Guangzhou.jpg",
  "license": "CC BY-SA 4.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
  "modifications": "裁切为 3:2、缩放并转换为 WebP",
  "representativeOnly": false
}
```

Open every file page and verify creator/license manually. For food assets without a licensed exact-store photo, choose a true photo of the named dish, set `representativeOnly: true`, and keep card caption “菜品示意，非该门店实拍”. Do not use hotlinked runtime URLs.

- [ ] **Step 4: Download, crop, and optimize assets**

Download source originals with network approval. Use `sharp` in a task-specific one-off script or CLI to `resize({ width: 1200, height: 800, fit: "cover", position: "attention" }).webp({ quality: 76 })`. Visually inspect all 30 outputs in contact sheets and re-crop any file whose landmark/dish is cut off.

- [ ] **Step 5: Build the static map image**

Create one OpenStreetMap-derived Guangzhou base raster covering the fixed bounds used by Task 6. The image contains the Pearl River, core district labels, attraction/food legend, and a Liwan/Yuexiu inset; the 30 numbered points are rendered as the semantic HTML overlay in Task 6 so the final page composite remains clickable and accessible. Add visible text “位置示意，非导航地图” and “© OpenStreetMap contributors”. Export `guangzhou-discovery-map.webp`.

- [ ] **Step 6: Verify assets and attribution parity**

Extend `tests/discovery-data.test.ts` to import `credits.json` and assert exact parity:

```ts
import discoveryCredits from "../public/images/discovery/credits.json";

expect(discoveryCredits.map((credit) => credit.placeId)).toEqual(
  discoveryPlaces.map((place) => place.id),
);
expect(discoveryCredits.map((credit) => `/images/discovery/${credit.file}`)).toEqual(
  discoveryPlaces.map((place) => place.photo.src),
);
```

Run: `node --test tests/photo-assets.test.mjs tests/discovery-assets.test.mjs`  
Then run: `npx vitest run tests/discovery-data.test.ts`  
Expected: PASS for 39 photos plus the map, and exact `credits.json`/`discoveryPlaces` parity.

- [ ] **Step 7: Commit assets**

```bash
git add public/images/discovery tests/discovery-assets.test.mjs tests/discovery-data.test.ts tests/photo-assets.test.mjs src/data/discovery.ts
git commit -m "feat: add licensed Guangzhou discovery imagery"
```

---

### Task 5: Photo and place card components

**Files:**
- Create: `src/features/discovery/DiscoveryPhoto.tsx`
- Create: `src/features/discovery/DiscoveryCard.tsx`
- Create: `tests/discovery-components.test.tsx`

**Interfaces:**
- Consumes: `DiscoveryPlace`, `calculateEditorialScore`, `buildDiscoveryBaiduUrl`.
- Produces: `<DiscoveryPhoto place priority />`, `<DiscoveryCard place expanded wished onToggleWish onOpen onShowOnMap />`.

- [ ] **Step 1: Write failing card tests**

Cover collapsed summary, computed score, absent/unverified platform score, verified platform source, detail content, food disclaimer, wishlist state, Baidu link safety, source links, photo fallback and accessible toggle names:

```tsx
it("renders an honest scored attraction card and expands details", () => {
  render(<DiscoveryCard place={chenClan} expanded={false} wished={false} onOpen={onOpen} onToggleWish={onWish} onShowOnMap={onMap} />);
  expect(screen.getByText("站内推荐 4.8")).toBeVisible();
  expect(screen.getByText("暂无可核验平台分")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "查看陈家祠详情" }));
  expect(onOpen).toHaveBeenCalledWith("chen-clan-academy");
});

it("labels a representative dish photo without implying store provenance", () => {
  render(<DiscoveryCard place={nanxin} expanded wished={false} onOpen={onOpen} onToggleWish={onWish} onShowOnMap={onMap} />);
  expect(screen.getByText("菜品示意，非该门店实拍")).toBeVisible();
});

it("marks a wished place as a route candidate without rewriting the itinerary", () => {
  render(<DiscoveryCard place={chenClan} expanded wished onOpen={onOpen} onToggleWish={onWish} onShowOnMap={onMap} />);
  expect(screen.getByRole("button", { name: "从想去清单移除陈家祠" })).toBeVisible();
  expect(screen.getByText("已加入路线候选，不会改写 8 月 20 日主线")).toBeVisible();
});
```

Trigger image `error`; expect the image to become hidden and an equal-size fallback with the place name and category to remain.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/discovery-components.test.tsx`  
Expected: FAIL because components are missing.

- [ ] **Step 3: Implement `DiscoveryPhoto`**

Use `useState(false)` for error state, `loading={priority ? "eager" : "lazy"}`, `fetchPriority={priority ? "high" : "auto"}`, `width={1200}`, `height={800}`. Always render a nearby `<details className="discovery-credit">` containing source and license links plus `modifications`; do not place attribution as unreadable text on top of the photo.

- [ ] **Step 4: Implement `DiscoveryCard`**

Use an `<article id={`discovery-card-${place.id}`}>`. The card header contains image, kind/district, name, computed score, summary, tags, duration and budget. Buttons have unique labels. Expanded details include description, highlights, opening, transit, four audience meters, nearby names, exact `verifiedAt`, sources and platform rating policy copy. All external anchors use `target="_blank" rel="noreferrer"`.

- [ ] **Step 5: Run component and accessibility-role tests**

Run: `npx vitest run tests/discovery-components.test.tsx`  
Expected: PASS; no duplicate accessible names inside one rendered card.

- [ ] **Step 6: Commit**

```bash
git add src/features/discovery/DiscoveryPhoto.tsx src/features/discovery/DiscoveryCard.tsx tests/discovery-components.test.tsx
git commit -m "feat: add discovery place cards"
```

---

### Task 6: Static map overlay and complete Discovery view

**Files:**
- Create: `src/features/discovery/DiscoveryMap.tsx`
- Create: `src/features/discovery/DiscoveryView.tsx`
- Modify: `tests/discovery-components.test.tsx`

**Interfaces:**
- Consumes: Task 1 data, Task 2 logic, Task 5 card/photo components.
- Produces: `<DiscoveryMap places selectedId onSelect />` and `<DiscoveryView>` with controlled hash/filter state through the exact `DiscoveryViewProps` interface in Step 4.

- [ ] **Step 1: Write failing map and view tests**

Add tests for:

- region named “发现广州” and heading “30 个地方，读懂广州的古今与烟火气”;
- six featured cards;
- search “双皮奶” returning only 南信;
- `kind=food` and `district=荔湾` composing correctly;
- sorting by couple score;
- empty state and clear button;
- map image alt text, 30 numbered buttons, two-color legend and disclaimer;
- map marker click calls `onSelect(id)` and scrolls/focuses the card;
- card “在总览图查看” scrolls/focuses the map marker;
- wishlist panel reflects controlled `wishlistIds`, supports attraction/food subfilters, individual removal and “清空想去” while preserving the main catalog.

Representative test:

```tsx
it("links map marker 1 to the same numbered card", () => {
  const onSelect = vi.fn();
  render(<DiscoveryMap places={discoveryPlaces} selectedId={null} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole("button", { name: "地图位置 1：陈家祠" }));
  expect(onSelect).toHaveBeenCalledWith("chen-clan-academy");
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/discovery-components.test.tsx`  
Expected: FAIL for missing map/view exports.

- [ ] **Step 3: Implement the static map as image plus semantic overlay**

Render the WebP inside a `position: relative` figure. Convert coordinates into percentages using a fixed Guangzhou bounding box:

```ts
const bounds = { west: 112.85, east: 113.65, south: 22.72, north: 23.42 };
const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * 100;
const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * 100;
```

Apply per-place `mapLabelOffset` after projection. Marker `<button>` text is the numeric index, its full accessible name includes place name. Use `aria-pressed` for the active marker and a separate list fallback beneath the map so positions remain operable if CSS or the image fails.

- [ ] **Step 4: Implement the controlled `DiscoveryView`**

Props:

```ts
interface DiscoveryViewProps {
  isActive: boolean;
  isMobile: boolean;
  filters: DiscoveryFilters;
  selectedPlaceId: string | null;
  wishlistIds: string[];
  onFiltersChange(filters: DiscoveryFilters): void;
  onSelectPlace(id: string | null): void;
  onToggleWish(id: string): void;
  onClearWishlist(): void;
}
```

Memoize filtered/sorted results. Keep the search input controlled. Group filter buttons in labeled fieldsets; show selected chips and count. Only the selected card is expanded. `selectAndReveal(id)` first invokes `onSelectPlace`, then in `requestAnimationFrame` scrolls/focuses `#discovery-card-${id}`. Provide a “只看想去” toggle without changing the persisted wishlist. The wishlist drawer has “全部 / 景点 / 美食” local subfilters, reuses `onToggleWish` for per-item removal, calls `onClearWishlist` for bulk removal, and displays “已加入路线候选，不会改写 8 月 20 日主线”.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run tests/discovery-components.test.tsx tests/discovery-logic.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/discovery/DiscoveryMap.tsx src/features/discovery/DiscoveryView.tsx tests/discovery-components.test.tsx
git commit -m "feat: build interactive Guangzhou discovery view"
```

---

### Task 7: Integrate Discover into the existing app navigation and history owner

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/features/trip/MobileAppShell.tsx`
- Modify: `src/features/trip/TripPlanner.tsx`
- Modify: `src/features/trip/TripViews.tsx`
- Modify: `tests/trip-components.test.tsx`

**Interfaces:**
- Consumes: `DiscoveryView`, discovery hash codec, wishlist storage.
- Produces: five-view app shell; single-owner history synchronization for discovery filters/detail.

- [ ] **Step 1: Write failing integration tests**

Add or update tests so they assert:

```tsx
expect(within(screen.getByRole("navigation", { name: "手机功能导航" })).getAllByRole("link")).toHaveLength(5);
expect(screen.getByRole("link", { name: /发现/ })).toHaveAttribute("href", "#discover");
```

Render `TripPlanner` with `#discover/chen-clan-academy?q=%E5%B2%AD%E5%8D%97`; expect active discover region, expanded 陈家祠 and restored query. Click 沙面, expect a hash beginning `#discover/shamian?`; dispatch `popstate`, expect 陈家祠 restored. Refresh-equivalent remount must restore the same state. Existing `#stop-detail`, `#map`, `#checklist` ownership tests must continue to pass.

Add a reset test: wishlist and existing trip progress are both cleared only after confirmation; cancel leaves both intact.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/trip-components.test.tsx`  
Expected: FAIL because `discover` is not a mobile view and no discover view is rendered.

- [ ] **Step 3: Add `discover` to the app shell**

Change `MobileView` to `"route" | "discover" | "map" | "todo" | "me"`. Add `{ id: "discover", label: "发现", mark: "探" }` after route. Add `discover` and `discover/*` ownership to the parser rather than a fixed `hashOwnership` lookup only.

- [ ] **Step 4: Make `TripPlanner` the only discovery history owner**

Initialize filters/selected ID by `parseDiscoveryHash(window.location.hash)`. `setDiscoveryFilters` and `setSelectedDiscoveryPlace` push or replace the encoded hash only if it differs. `popstate`/`hashchange` parse the full hash and update the controlled view state without pushing a second history entry. Unknown place IDs fall back to the discovery list; malformed encoding leaves the current safe view unchanged.

Pass `tripState.wishlistPlaceIds`, `toggleWishlistPlace`, and `clearWishlist` into `DiscoveryView`. Hide `NextStopBar` on mobile discovery, as it is route-specific. Update top bar copy on discovery to “发现广州 · 30 个精选”。

- [ ] **Step 5: Update desktop navigation and My summary**

Add desktop “发现” link. In `MyTripView`, render “想去地点 N 个” and a button that calls `onNavigateView("discover")`. Keep original booking, budget, credits and reset behavior unchanged.

- [ ] **Step 6: Run integration regression**

Run: `npx vitest run tests/trip-components.test.tsx tests/trip-storage.test.ts tests/discovery-components.test.tsx`  
Expected: PASS, including original route/map/todo/me behavior.

- [ ] **Step 7: Commit**

```bash
git add src/data/types.ts src/features/trip/MobileAppShell.tsx src/features/trip/TripPlanner.tsx src/features/trip/TripViews.tsx tests/trip-components.test.tsx
git commit -m "feat: integrate discovery app navigation"
```

---

### Task 8: Visual system, responsive layout, metadata, and social preview

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `static-site/index.html`
- Create: `public/og.png`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/pages-artifact.test.mjs`

**Interfaces:**
- Consumes: class names from Tasks 5–7.
- Produces: polished responsive magazine layout and correct unfurl metadata.

- [ ] **Step 1: Write failing artifact and SSR expectations**

Add assertions that built HTML/scripts include “发现广州”, `images/discovery/`, `guangzhou-discovery-map.webp`, and `og.png`; assert no `upload.wikimedia.org`, `tile.openstreetmap.org`, Leaflet or runtime image URLs. Assert title/description mention both 一日游 and 30 个广州精选。

- [ ] **Step 2: Verify RED**

Run: `npm run build && node --test tests/rendered-html.test.mjs && npm run build:pages && node --test tests/pages-artifact.test.mjs`  
Expected: FAIL on missing discovery metadata/assets.

- [ ] **Step 3: Implement magazine-style discovery CSS**

Extend existing rice-paper/榕绿/朱砂 tokens. Desktop: 12-column hero, two-column filters/content, responsive 3-card grid, wide map. Mobile: single-column cards, horizontally scrollable filter chips with invisible scrollbar, sticky filter/sort summary beneath the app top bar, five equal bottom tabs, and bottom padding large enough for navigation. Use `aspect-ratio: 3 / 2` without a conflicting `min-height`; all buttons/links have `min-height: 44px`; use `overflow-wrap:anywhere` only on URLs/credits, never globally.

Map markers must remain at least 30px visually but use a 44px transparent hit box. Dense Liwan/Yuexiu inset becomes a separate responsive panel below the main map on ≤760px. Respect `prefers-reduced-motion` by disabling smooth scrolling and hover transforms.

- [ ] **Step 4: Generate exactly one bespoke social preview**

Use the `imagegen` skill once with a brief based on the finished site: 1200×630 landscape, rice-paper background, banyan green and cinnabar palette, editorial collage of authentic-feeling Guangzhou architecture/river/tea motifs, exact Chinese title “发现广州 · 30 个地方读懂一座城” and subtitle “情侣优先的景点与粤味指南”. Inspect text; retry once only if unusable. Save the validated result as `public/og.png`. The social card is promotional artwork, never used as a place “实景照片”.

- [ ] **Step 5: Wire metadata for both builds**

Replace the static `metadata` export in `app/layout.tsx` with `generateMetadata`. Read `x-forwarded-host`/`host` and `x-forwarded-proto` through `headers()`; fall back to `https://z-xq7.github.io/guangzhou-day-trip-0820/`, then construct an absolute `/og.png` URL for Open Graph and X metadata. Use title “一日广州｜路线与 30 个广州精选” and a description mentioning route, real photos, scores and static map. Add equivalent static meta tags to `static-site/index.html` using `https://z-xq7.github.io/guangzhou-day-trip-0820/og.png`.

- [ ] **Step 6: Run builds and artifact tests**

Run: `npm run build && node --test tests/rendered-html.test.mjs && npm run build:pages && node --test tests/pages-artifact.test.mjs`  
Expected: both builds and artifact suites PASS.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css app/layout.tsx static-site/index.html public/og.png tests/rendered-html.test.mjs tests/pages-artifact.test.mjs
git commit -m "feat: polish discovery visuals and metadata"
```

---

### Task 9: Full verification, browser QA, production deployment, and source update

**Files:**
- Modify: `README.md`
- Verify without changing unless a deployment failure proves it necessary: `.github/workflows/pages.yml`
- Test: all `tests/`

**Interfaces:**
- Consumes: complete app from Tasks 1–8.
- Produces: verified GitHub Pages deployment and a clean release commit.

- [ ] **Step 1: Run fresh static analysis and complete automated verification**

Run:

```bash
npm run lint
npm test
git diff --check
```

Expected: lint 0 errors; Vitest, asset tests, Vinext build, SSR tests, Pages build and Pages artifact tests all PASS; no whitespace errors.

- [ ] **Step 2: Start a production-equivalent Pages preview**

Run `npm run build:pages`, then serve `dist-pages` with a retained local HTTP server mounted so `/guangzhou-day-trip-0820/` resolves. Open the exact preview URL once in the in-app browser.

- [ ] **Step 3: Browser QA at four viewports**

At 320×568, 375×812, 390×844 and 1440×900 verify:

- route remains the default and five navigation items are visible;
- discover first screen communicates 30 places and featured content;
- search, kind/district/audience filters, sort, empty state and clear work;
- every card can expand, wish, open Baidu and reveal sources;
- map image, legend, 30 markers and Liwan/Yuexiu inset are readable;
- marker→card and card→marker scrolling/focus work;
- `#discover/<id>` direct load, browser Back and refresh restore state;
- no horizontal overflow; bottom nav does not cover controls; console has no warning/error.

- [ ] **Step 4: Offline and storage-denial QA**

Load discovery once, disable network, refresh and confirm local text/photos/map/filter/wishlist work; external links may fail with an explicit online expectation. In an isolated browser context deny storage and confirm wishlist still works during the session without blocking dialogs.

- [ ] **Step 5: Run Lighthouse**

Run Lighthouse against the production preview in mobile mode. Expected: Accessibility ≥95 and Performance ≥85. Save only concise numeric results in the release note; do not commit generated Lighthouse HTML unless requested.

- [ ] **Step 6: Request code review and address only verified findings**

Use `superpowers:requesting-code-review`. Review the complete diff from `f00676b` to HEAD against the approved spec. For any actionable bug, use `superpowers:receiving-code-review`, add a reproducing test, implement the root-cause fix, and rerun affected plus full verification.

- [ ] **Step 7: Update documentation and commit final QA fixes**

Update README feature list, local commands, public URL, source/attribution policy and last verification date. Do not modify `.github/workflows/pages.yml` when its existing Node 22.13.0 test/build/deploy flow passes. Commit the README and any root-cause QA fixes:

```bash
git add README.md .github/workflows/pages.yml src tests public app static-site
git commit -m "docs: document Guangzhou discovery guide"
```

- [ ] **Step 8: Push and deploy GitHub Pages**

Confirm `gh auth status` for the user’s `Z-xq7` account. Push the completed branch to repository `main` only after showing the exact commit range and confirming no unrelated changes. Wait for the GitHub Pages workflow to succeed, then open:

`https://z-xq7.github.io/guangzhou-day-trip-0820/#discover`

Repeat the 390px smoke check on production.

- [ ] **Step 9: Validate Sites compatibility without replacing the public link**

Because the project contains `.openai/hosting.json`, run the Sites/Vinext production build and follow `sites-hosting` for a deployment compatibility check. Keep GitHub Pages as the primary public deliverable because the user previously confirmed that route after `chatgpt.site` access was blocked. Do not replace or remove the working GitHub Pages URL.

- [ ] **Step 10: Final completion report**

Report the public `#discover` URL, 30-place composition, scoring policy, static map behavior, photos/license status, verification totals and any unavoidable external-link limitations. Include the pushed commit directive only after push actually succeeds.
