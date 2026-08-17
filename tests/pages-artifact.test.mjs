import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const photoFiles = [
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

const repositoryBase = "/guangzhou-day-trip-0820/";
const distRoot = new URL("../dist-pages/", import.meta.url);
const discoveryPhotoFiles = Array.from(
  { length: 30 },
  (_, index) => `${String(index + 1).padStart(2, "0")}-`,
);

test("builds a repository-scoped static trip planner", async () => {
  const html = await readFile(new URL("index.html", distRoot), "utf8");
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>一日广州｜路线与 30 个广州精选<\/title>/i);
  assert.match(html, /og:image/);
  assert.match(html, /https:\/\/z-xq7\.github\.io\/guangzhou-day-trip-0820\/og\.png/);

  const entryUrls = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
    .map((match) => match[1])
    .filter((url) => url.startsWith("/"));

  assert.ok(entryUrls.length >= 2, "expected generated JavaScript and CSS entries");
  for (const url of entryUrls) {
    assert.ok(url.startsWith(repositoryBase), `${url} must use the Pages base path`);
    const relativePath = url.slice(repositoryBase.length).split(/[?#]/, 1)[0];
    await access(new URL(relativePath, distRoot));
  }

  const scripts = await Promise.all(
    entryUrls
      .filter((url) => url.endsWith(".js"))
      .map((url) => readFile(new URL(url.slice(repositoryBase.length), distRoot), "utf8")),
  );
  const styles = await Promise.all(
    entryUrls
      .filter((url) => url.endsWith(".css"))
      .map((url) => readFile(new URL(url.slice(repositoryBase.length), distRoot), "utf8")),
  );

  assert.match(scripts.join("\n"), /tile\.openstreetmap\.org/);
  assert.match(scripts.join("\n"), /OpenStreetMap contributors/);
  assert.match(scripts.join("\n"), /images\/stops\//);
  assert.match(scripts.join("\n"), /images\/discovery\//);
  assert.match(scripts.join("\n"), /guangzhou-overview-map\.webp/);
  const bundledCss = styles.join("\n");
  assert.match(bundledCss, /\.leaflet-container/);
  const mobileCss = bundledCss.match(
    /@media \(width<=760px\)\{([\s\S]*?)\}@media \(width<=430px\)/,
  )?.[1];
  assert.ok(mobileCss, "expected a bundled mobile stylesheet");
  assert.match(
    mobileCss,
    /\.discovery-map-live-layer \.leaflet-bottom\{bottom:calc\(64px \+ env\(safe-area-inset-bottom\)\)\}/,
  );
  assert.doesNotMatch(scripts.join("\n"), /maps\.googleapis\.com|webapi\.amap\.com/);
  assert.doesNotMatch(scripts.join("\n"), /upload\.wikimedia\.org/i);
  for (const file of photoFiles) {
    await access(new URL(`images/stops/${file}`, distRoot));
  }
  const discoveryDirectory = new URL("images/discovery/", distRoot);
  const discoveryCredits = JSON.parse(await readFile(new URL("credits.json", discoveryDirectory), "utf8"));
  assert.equal(discoveryCredits.length, 30);
  for (const prefix of discoveryPhotoFiles) {
    const credit = discoveryCredits.find((item) => item.file.startsWith(prefix));
    assert.ok(credit, `missing discovery photo ${prefix}`);
    await access(new URL(credit.file, discoveryDirectory));
  }
  await access(new URL("guangzhou-overview-map.webp", discoveryDirectory));
  await access(new URL("og.png", distRoot));
  await assert.rejects(access(new URL("assets/leaflet.css", distRoot)));
});
