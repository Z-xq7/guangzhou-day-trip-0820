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
