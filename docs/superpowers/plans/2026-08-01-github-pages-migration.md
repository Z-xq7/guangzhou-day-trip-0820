# GitHub Pages Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the existing Guangzhou day-trip planner at `https://z-xq7.github.io/guangzhou-day-trip-0820/` from a public `Z-xq7/guangzhou-day-trip-0820` repository without breaking the existing Sites build.

**Architecture:** Keep the current Vinext/Sites entry intact and add a second, client-only Vite entry that renders the same `TripPlanner` into a static GitHub Pages artifact. Resolve Leaflet's deferred stylesheet relative to the current document, deploy `dist-pages/` with GitHub's official Pages Actions, and validate both build targets plus the unauthenticated production URL.

**Tech Stack:** React 19, TypeScript, Vite 8, Vinext, Vitest, Node test runner, Leaflet, GitHub Actions, GitHub Pages.

## Global Constraints

- Repository: public `Z-xq7/guangzhou-day-trip-0820` with default branch `main`.
- Production URL: `https://z-xq7.github.io/guangzhou-day-trip-0820/`.
- Preserve the existing Sites project, `.openai/hosting.json`, `npm run build`, UI, trip data, local persistence, and map fallback.
- Do not request location, upload trip state, add a server, or add a GitHub token to source or Actions secrets.
- Use TDD for runtime and build behavior: observe the targeted test fail, implement the minimum, then observe it and the full suite pass.
- GitHub Actions YAML and human documentation are configuration/documentation exceptions: validate them through a real workflow run and live URL rather than source-text tests.
- Before implementation, follow `superpowers:using-git-worktrees`; this checkout is a normal repository, so obtain the user's isolation preference before editing code.

---

### Task 1: Make deferred map assets base-path safe

**Files:**
- Modify: `tests/trip-components.test.tsx`
- Modify: `src/features/trip/TripMap.tsx`

**Interfaces:**
- Produces: `resolveTripAssetUrl(path: string, baseUrl?: string): string` in `TripMap.tsx`.
- Consumes: `document.baseURI` when `baseUrl` is omitted.
- Existing caller: `ensureLeafletStyles()` uses the function for `assets/leaflet.css`.

- [ ] **Step 1: Write the failing behavior test**

Replace the existing named `TripMap` import with a namespace import, keep the existing bindings through destructuring, and add the test without importing a not-yet-existing named export at module-load time:

```tsx
import * as tripMapModule from "../src/features/trip/TripMap";

const {
  MAP_LOAD_ROOT_MARGIN,
  MAP_MARKER_SIZE,
  RouteFallback,
} = tripMapModule;

describe("TripMap assets", () => {
  it("resolves deferred assets inside a GitHub Pages repository base", () => {
    const resolveTripAssetUrl = (
      tripMapModule as typeof tripMapModule & {
        resolveTripAssetUrl?: (path: string, baseUrl?: string) => string;
      }
    ).resolveTripAssetUrl;

    expect(resolveTripAssetUrl).toBeTypeOf("function");
    expect(
      resolveTripAssetUrl?.(
        "/assets/leaflet.css",
        "https://z-xq7.github.io/guangzhou-day-trip-0820/",
      ),
    ).toBe(
      "https://z-xq7.github.io/guangzhou-day-trip-0820/assets/leaflet.css",
    );
  });
});
```

The production mutation this catches is restoring the current site-root URL `/assets/leaflet.css`, which becomes a 404 on a repository-scoped Pages site.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run tests/trip-components.test.tsx
```

Expected: one failed assertion because `resolveTripAssetUrl` is `undefined`; existing component tests remain green.

- [ ] **Step 3: Implement the minimal URL resolver**

In `src/features/trip/TripMap.tsx`, add:

```ts
export function resolveTripAssetUrl(path: string, baseUrl?: string) {
  const relativePath = path.replace(/^\/+/, "");
  return new URL(relativePath, baseUrl ?? document.baseURI).href;
}
```

Then replace the hard-coded assignment in `ensureLeafletStyles()`:

```ts
link.href = resolveTripAssetUrl("assets/leaflet.css");
```

- [ ] **Step 4: Run focused and complete unit tests**

Run:

```bash
npx vitest run tests/trip-components.test.tsx
npm run test:unit
```

Expected: the new asset-resolution test and all existing Vitest tests pass with no warnings.

- [ ] **Step 5: Commit the base-path fix**

```bash
git add tests/trip-components.test.tsx src/features/trip/TripMap.tsx
git commit -m "fix: resolve map assets under Pages base path"
```

---

### Task 2: Add the independent static Pages build

**Files:**
- Create: `tests/pages-artifact.test.mjs`
- Create: `pages/index.html`
- Create: `pages/main.tsx`
- Create: `vite.pages.config.ts`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm run build:pages`, which writes a deployable site to `dist-pages/`.
- Produces: `npm run test:pages`, which validates the built artifact and its repository-prefixed entry assets.
- Consumes: `TripPlanner`, `app/globals.css`, and `public/assets/**` without duplicating them.

- [ ] **Step 1: Write the failing artifact test**

Create `tests/pages-artifact.test.mjs`:

```js
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const repositoryBase = "/guangzhou-day-trip-0820/";
const distRoot = new URL("../dist-pages/", import.meta.url);

test("builds a repository-scoped static trip planner", async () => {
  const html = await readFile(new URL("index.html", distRoot), "utf8");
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>广州一日 · 两个人的岭南漫游<\/title>/i);

  const entryUrls = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
    .map((match) => match[1])
    .filter((url) => url.startsWith("/"));

  assert.ok(entryUrls.length >= 2, "expected generated JavaScript and CSS entries");
  for (const url of entryUrls) {
    assert.ok(url.startsWith(repositoryBase), `${url} must use the Pages base path`);
    const relativePath = url.slice(repositoryBase.length).split(/[?#]/, 1)[0];
    await access(new URL(relativePath, distRoot));
  }

  await access(new URL("assets/leaflet.css", distRoot));
  await access(new URL("assets/images/marker-icon.png", distRoot));
});
```

- [ ] **Step 2: Run the artifact test and verify RED**

Run:

```bash
node --test tests/pages-artifact.test.mjs
```

Expected: failure reading `dist-pages/index.html`, because the Pages build does not exist yet.

- [ ] **Step 3: Create the static HTML and React entry**

Create `pages/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#f3ecdf" />
    <meta
      name="description"
      content="8 月 20 日从深圳出发：早茶、西关、陈家祠、沙面、北京路与珠江夜游的互动路线。"
    />
    <title>广州一日 · 两个人的岭南漫游</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

Create `pages/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import { TripPlanner } from "../src/features/trip/TripPlanner";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Trip planner root element is missing");
}

createRoot(rootElement).render(<TripPlanner />);
```

- [ ] **Step 4: Add the dedicated Vite configuration**

Create `vite.pages.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const fromProjectRoot = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: "/guangzhou-day-trip-0820/",
  root: fromProjectRoot("./pages/"),
  publicDir: fromProjectRoot("./public/"),
  plugins: [react()],
  build: {
    outDir: fromProjectRoot("./dist-pages/"),
    emptyOutDir: true,
  },
});
```

- [ ] **Step 5: Wire build and test scripts**

Add these scripts to `package.json` and extend `test` so both hosting targets are covered:

```json
{
  "scripts": {
    "build:pages": "vite build --config vite.pages.config.ts",
    "test": "vitest run && npm run build && node --test tests/rendered-html.test.mjs && npm run build:pages && npm run test:pages",
    "test:pages": "node --test tests/pages-artifact.test.mjs"
  }
}
```

Add the generated directory to `.gitignore`:

```gitignore
/dist-pages/
```

- [ ] **Step 6: Build and verify GREEN**

Run:

```bash
npm run build:pages
npm run test:pages
npm run test:unit
```

Expected: Vite emits `dist-pages/index.html`, the artifact test verifies repository-prefixed entry assets, and all unit tests pass.

- [ ] **Step 7: Commit the static build**

```bash
git add .gitignore package.json package-lock.json pages tests/pages-artifact.test.mjs vite.pages.config.ts
git commit -m "feat: add static GitHub Pages build"
```

---

### Task 3: Add automatic deployment and project handoff documentation

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `main`, `package-lock.json`, `npm run test:unit`, `npm run build:pages`, and `npm run test:pages`.
- Produces: the GitHub Pages deployment environment and its public URL.

- [ ] **Step 1: Add the official Pages workflow**

Create `.github/workflows/pages.yml`:

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v6
      - name: Set up Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 22.13.0
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Run unit tests
        run: npm run test:unit
      - name: Build Pages artifact
        run: npm run build:pages
      - name: Verify Pages artifact
        run: npm run test:pages
      - name: Configure Pages
        uses: actions/configure-pages@v5
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v4
        with:
          path: dist-pages

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Replace the starter README with the project handoff**

Use this concise content in `README.md`:

````markdown
# 广州情侣一日游互动路线

2026 年 8 月 20 日从深圳出发的广州一日游互动网页，包含西关文化、美食对比、实时可缩放地图、正常/下雨/高铁晚点方案、预算和本地打卡清单。

公开访问：<https://z-xq7.github.io/guangzhou-day-trip-0820/>

## 本地开发

要求 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

## 验证与构建

```bash
npm run lint
npm test
npm run build:pages
```

- `npm run build`：现有 Vinext/Sites 构建。
- `npm run build:pages`：输出 GitHub Pages 静态文件到 `dist-pages/`。
- 地图依赖 OpenStreetMap 网络；加载失败时页面会显示路线示意，其他行程内容仍可使用。
````

- [ ] **Step 3: Run the complete local verification**

Run fresh commands:

```bash
npm run lint
npm test
git diff --check
```

Expected: lint exits 0; Vitest, Sites build/render tests, Pages build/artifact tests all pass; Git reports no whitespace errors.

- [ ] **Step 4: Commit workflow and documentation**

```bash
git add .github/workflows/pages.yml README.md
git commit -m "ci: deploy trip planner to GitHub Pages"
```

---

### Task 4: Create the public repository, publish, and verify production

**Files:**
- No new source files.
- External targets: `Z-xq7/guangzhou-day-trip-0820`, its Actions runs, and its Pages environment.

**Interfaces:**
- Consumes: the fully verified local `main` branch and the Chrome session authenticated as `Z-xq7`.
- Produces: `origin`, a successful Pages workflow run, and the unauthenticated public site.

- [ ] **Step 1: Re-check the exact source state before publishing**

Run:

```bash
git status --short
git log --oneline -5
npm run lint
npm test
```

Expected: clean worktree, the migration commits are visible, and every verification exits 0.

- [ ] **Step 2: Create the empty public GitHub repository**

In the authenticated `Z-xq7` Chrome session, create:

- Owner: `Z-xq7`
- Repository name: `guangzhou-day-trip-0820`
- Visibility: Public
- Description: `广州情侣一日游互动路线：美食、地标、地图、预算与雨天/晚点方案`
- Initialize README: off
- Add `.gitignore`: none
- License: none

Verify the resulting repository header is exactly `Z-xq7/guangzhou-day-trip-0820` before pushing.

- [ ] **Step 3: Attach the remote and push `main`**

Run:

```bash
git remote add origin https://github.com/Z-xq7/guangzhou-day-trip-0820.git
git push -u origin main
```

If `origin` already exists, inspect it first and use `git remote set-url origin https://github.com/Z-xq7/guangzhou-day-trip-0820.git` only when it is not the target above. If authentication fails, stop rather than pushing to the Connector identity `wangxiaogou1379`; complete GitHub's official authentication for `Z-xq7`, then retry the same push.

- [ ] **Step 4: Verify GitHub Actions and Pages settings**

Open the repository Actions page and wait for `Deploy GitHub Pages` to finish. If GitHub asks for a Pages source, set Source to `GitHub Actions`. Inspect the failed step if the run is red; do not hand off the URL until both `build` and `deploy` are green.

- [ ] **Step 5: Verify the public URL without relying on the signed-in session**

Run:

```bash
curl -fsSIL https://z-xq7.github.io/guangzhou-day-trip-0820/
```

Expected: an HTTP success response that resolves to the GitHub Pages URL, not `403`, `404`, or a login page.

Open the URL in an unauthenticated browser context and verify:

- the title and hero render;
- scenario switching changes the route;
- a timeline stop opens its details;
- the map loads and a marker selects its stop; the existing component test remains the failure-path proof for `RouteFallback`;
- a checklist change survives reload;
- the Amap navigation link opens an encoded destination URL;
- 375×812 and 390×844 have no horizontal overflow and the fixed next-stop bar does not cover the final content.

- [ ] **Step 6: Report the verified handoff**

Return both links:

- Site: `https://z-xq7.github.io/guangzhou-day-trip-0820/`
- Source: `https://github.com/Z-xq7/guangzhou-day-trip-0820`

State the fresh lint/test result, Actions result, and unauthenticated HTTP/mobile verification. Do not claim completion if any one of those checks is missing.
