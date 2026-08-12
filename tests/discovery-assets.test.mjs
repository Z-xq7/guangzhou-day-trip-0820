import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const slugs = [
  "chen-clan-academy",
  "yongqingfang",
  "cantonese-opera-museum",
  "lychee-bay",
  "shamian",
  "beijing-road",
  "dafo-temple",
  "sacred-heart-cathedral",
  "nanyue-king-museum",
  "sun-yat-sen-memorial-hall",
  "yuexiu-park",
  "dongshankou",
  "canton-tower",
  "huacheng-square",
  "guangdong-museum",
  "pearl-river-cruise",
  "baiyun-mountain",
  "south-china-botanical-garden",
  "haizhu-wetland",
  "chimelong-resort",
  "baomo-garden",
  "guangzhou-restaurant-wenchang",
  "taotaoju-dishifu",
  "panxi-restaurant",
  "bingsheng-mansion",
  "huishijia-binjiang",
  "chen-tianji",
  "nanxin-dessert",
  "wucaiji-noodles",
  "yinji-rice-roll",
];

const photos = slugs.map(
  (slug, index) => `${String(index + 1).padStart(2, "0")}-${slug}.webp`,
);

test("ships 30 optimized local discovery photos with complete attribution", async () => {
  const creditsUrl = new URL("../public/images/discovery/credits.json", import.meta.url);
  const credits = JSON.parse(await readFile(creditsUrl, "utf8"));
  assert.equal(credits.length, 30);
  assert.deepEqual(credits.map((credit) => credit.file), photos);
  assert.equal(new Set(credits.map((credit) => credit.file)).size, 30);

  for (const credit of credits) {
    for (const key of ["author", "sourceUrl", "license", "licenseUrl", "modifications"]) {
      assert.ok(credit[key], `${credit.file} is missing ${key}`);
    }

    const url = new URL(`../public/images/discovery/${credit.file}`, import.meta.url);
    const info = await stat(url);
    assert.ok(info.size > 8_000, `${credit.file} is unexpectedly empty`);
    assert.ok(info.size <= 300 * 1024, `${credit.file} exceeds 300 KiB`);

    const image = sharp(fileURLToPath(url), { failOn: "error" });
    const metadata = await image.metadata();
    assert.equal(metadata.format, "webp", `${credit.file} is not WebP`);
    assert.equal(metadata.width, 1200, `${credit.file} must be 1200 px wide`);
    assert.equal(metadata.height, 800, `${credit.file} must be 800 px tall`);
    const decoded = await image.clone().raw().toBuffer({ resolveWithObject: true });
    assert.ok(decoded.data.length > 0, `${credit.file} did not decode any pixels`);
  }
});

test("ships a readable locally cached Guangzhou overview map", async () => {
  const mapUrl = new URL("../public/images/discovery/guangzhou-overview-map.webp", import.meta.url);
  const info = await stat(mapUrl);
  assert.ok(info.size > 20_000, "map is unexpectedly empty");
  assert.ok(info.size <= 500 * 1024, "map exceeds 500 KiB");

  const metadata = await sharp(fileURLToPath(mapUrl), { failOn: "error" }).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1440);
  assert.equal(metadata.height, 900);
});
