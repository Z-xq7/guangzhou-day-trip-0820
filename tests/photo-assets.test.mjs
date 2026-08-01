import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

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
    const info = await stat(url);
    assert.ok(info.size > 8_000, `${file} is unexpectedly empty`);
    assert.ok(info.size <= 180 * 1024, `${file} exceeds 180 KiB`);

    const image = sharp(fileURLToPath(url), { failOn: "error" });
    const metadata = await image.metadata();
    assert.equal(metadata.format, "webp", `${file} is not WebP`);
    assert.ok(metadata.width && metadata.height, `${file} has invalid dimensions`);
    assert.ok(Math.max(metadata.width, metadata.height) <= 1600, `${file} exceeds 1600 px`);
    const ratio = Math.max(metadata.width, metadata.height) / Math.min(metadata.width, metadata.height);
    const allowedRatios = [3 / 2, 4 / 3];
    assert.ok(
      allowedRatios.some((allowedRatio) => Math.abs(ratio - allowedRatio) <= 0.01),
      `${file} ratio ${ratio.toFixed(4)} must be 3:2 or 4:3`,
    );

    const decoded = await image.clone().raw().toBuffer({ resolveWithObject: true });
    assert.equal(decoded.info.width, metadata.width, `${file} decoded width changed`);
    assert.equal(decoded.info.height, metadata.height, `${file} decoded height changed`);
    assert.ok(decoded.data.length > 0, `${file} did not decode any pixels`);
  }
});
