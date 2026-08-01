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

  const scripts = await Promise.all(
    entryUrls
      .filter((url) => url.endsWith(".js"))
      .map((url) => readFile(new URL(url.slice(repositoryBase.length), distRoot), "utf8")),
  );

  assert.doesNotMatch(scripts.join("\n"), /tile\.openstreetmap\.org|leaflet/i);
  await assert.rejects(access(new URL("assets/leaflet.css", distRoot)));
});
