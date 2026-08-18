import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Guangzhou day-trip planner", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>一日广州｜路线与 30 个广州精选<\/title>/i);
  assert.match(html, /趁一日，饮啖茶/);
  assert.match(html, /路线规划/);
  assert.match(html, /地图与导航/);
  assert.match(html, /行前待办/);
  assert.match(html, /我的行程/);
  assert.match(html, /发现广州/);
  assert.match(html, /30 个地方，读懂广州的古今与烟火气/);
  assert.match(html, /images\/discovery\/01-chen-clan-academy\.webp/);
  assert.match(html, /guangzhou-core-map\.webp/);
  assert.match(html, /guangzhou-full-map\.webp/);
  assert.match(html, /静态双层景点地图/);
  assert.match(html, /地图为位置示意，不替代实时导航/);
  assert.match(html, /原图：广州市政府/);
  assert.doesNotMatch(html, /可缩放全城地图|两点直线距离比较|正在加载可缩放地图/);
  assert.match(html, /href="THIRD_PARTY_NOTICES\.txt"[^>]*>第三方软件许可<\/a>/);
  assert.match(html, /<ol aria-label="广州景点编号表">/);
  assert.equal(html.match(/href="#discover\//g)?.length, 21);
  assert.match(html, /og\.png/);
  assert.doesNotMatch(html, /<section id="(?:route|discover|map|todo|me)"[^>]*aria-hidden/);
  assert.match(html, /8 月 20 日路线顺序/);
  assert.match(html, /下雨/);
  assert.match(html, /高铁晚点/);
  assert.match(html, /珠江夜游/);
  assert.match(html, /不登录、不定位、不上传数据/);
  assert.doesNotMatch(html, /maps\.googleapis\.com|webapi\.amap\.com/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("removes starter-only assets and metadata", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /TripPlanner/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(layout, /一日广州｜路线与 30 个广州精选/);
  assert.match(layout, /og\.png/);
  assert.doesNotMatch(page + layout, /codex-preview|_sites-preview|SkeletonPreview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});

test("retains complete third-party notices in both Vinext asset artifacts", async () => {
  const [leafletLicense, markerClusterLicense, clientNotices, serverNotices] = await Promise.all([
    readFile(new URL("../node_modules/leaflet/LICENSE", import.meta.url), "utf8"),
    readFile(
      new URL("../node_modules/leaflet.markercluster/MIT-LICENCE.txt", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../dist/client/THIRD_PARTY_NOTICES.txt", import.meta.url), "utf8"),
    readFile(new URL("../dist/server/THIRD_PARTY_NOTICES.txt", import.meta.url), "utf8"),
  ]);
  const normalizedLicenses = [leafletLicense, markerClusterLicense]
    .map((license) => license.replaceAll("\r\n", "\n").trim());

  for (const notices of [clientNotices, serverNotices]) {
    for (const license of normalizedLicenses) {
      assert.ok(notices.includes(license));
    }
  }
});
