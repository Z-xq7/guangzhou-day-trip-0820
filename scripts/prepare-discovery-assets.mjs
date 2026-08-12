import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const sourcePath = path.join(root, "src/data/discovery.ts");
const outputDirectory = path.join(root, "public/images/discovery");
const userAgent =
  "GuangzhouDiscoveryGuide/1.0 (https://github.com/Z-xq7/guangzhou-day-trip-0820)";
const modifications = "从原图裁切为 3:2、缩放并转换为 WebP";
const retrievedAt = "2026-08-12";

const licenseUrls = {
  ccBySa4: "https://creativecommons.org/licenses/by-sa/4.0/",
  ccBy4: "https://creativecommons.org/licenses/by/4.0/",
  ccBySa3: "https://creativecommons.org/licenses/by-sa/3.0/",
  ccBy2: "https://creativecommons.org/licenses/by/2.0/",
  ccBySa2: "https://creativecommons.org/licenses/by-sa/2.0/",
  cc0: "https://creativecommons.org/publicdomain/zero/1.0/",
  publicDomain: "https://creativecommons.org/publicdomain/mark/1.0/",
};

function decodeLiteral(value) {
  return JSON.parse(`"${value}"`);
}

function extractCredits(source) {
  const credits = new Map();
  const creditPattern = /^\s*(\d+): \{ author: "([^"]+)", sourceUrl: "([^"]+)", license: "([^"]+)", licenseUrl: (\w+) \},$/gm;
  for (const match of source.matchAll(creditPattern)) {
    const [, rawIndex, author, sourceUrl, license, licenseKey] = match;
    const licenseUrl = licenseUrls[licenseKey];
    if (!licenseUrl) throw new Error(`Unknown license key: ${licenseKey}`);
    credits.set(Number(rawIndex), {
      author: decodeLiteral(author),
      sourceUrl,
      license,
      licenseUrl,
    });
  }

  const files = new Map();
  const filePattern = /photo:\s*discoveryPhoto\((\d+),\s*"([^"]+)"/g;
  for (const match of source.matchAll(filePattern)) {
    const index = Number(match[1]);
    files.set(index, `${String(index).padStart(2, "0")}-${match[2]}.webp`);
  }

  if (credits.size !== 30 || files.size !== 30) {
    throw new Error(`Expected 30 credits and files, found ${credits.size} and ${files.size}`);
  }

  return [...credits.entries()].map(([index, credit]) => ({
    file: files.get(index),
    ...credit,
    modifications,
    retrievedAt,
  }));
}

async function fetchBuffer(url) {
  const response = await fetch(url, { headers: { "User-Agent": userAgent } });
  if (!response.ok) throw new Error(`${response.status} while fetching ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function resolveCommonsImage(sourceUrl) {
  const source = new URL(sourceUrl);
  const title = decodeURIComponent(source.pathname.replace("/wiki/", "")).replaceAll("_", " ");
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  api.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "1800",
    titles: title,
  }).toString();
  const response = await fetch(api, { headers: { "User-Agent": userAgent } });
  if (!response.ok) throw new Error(`${response.status} while resolving ${title}`);
  const payload = await response.json();
  const page = payload.query?.pages?.[0];
  const imageInfo = page?.imageinfo?.[0];
  if (!imageInfo || page.missing) throw new Error(`Commons file not found: ${title}`);
  return imageInfo.thumburl ?? imageInfo.url;
}

async function preparePhoto(credit) {
  const imageUrl = await resolveCommonsImage(credit.sourceUrl);
  const input = await fetchBuffer(imageUrl);
  const output = path.join(outputDirectory, credit.file);
  await sharp(input, { failOn: "error" })
    .autoOrient()
    .resize(1200, 800, { fit: "cover", position: "attention" })
    .webp({ quality: 74, effort: 5, smartSubsample: true })
    .toFile(output);
  return credit.file;
}

function longitudeToTileX(longitude, zoom) {
  return ((longitude + 180) / 360) * 2 ** zoom;
}

function latitudeToTileY(latitude, zoom) {
  const radians = (latitude * Math.PI) / 180;
  return (
    ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * 2 ** zoom
  );
}

async function prepareOverviewMap() {
  const zoom = 11;
  const bounds = { west: 113, east: 113.66, north: 23.22, south: 22.84 };
  const left = longitudeToTileX(bounds.west, zoom);
  const right = longitudeToTileX(bounds.east, zoom);
  const top = latitudeToTileY(bounds.north, zoom);
  const bottom = latitudeToTileY(bounds.south, zoom);
  const minX = Math.floor(left);
  const maxX = Math.floor(right);
  const minY = Math.floor(top);
  const maxY = Math.floor(bottom);
  const columns = maxX - minX + 1;
  const rows = maxY - minY + 1;

  const tiles = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const url = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
      tiles.push({
        input: await fetchBuffer(url),
        left: (x - minX) * 256,
        top: (y - minY) * 256,
      });
    }
  }

  const canvas = sharp({
    create: {
      width: columns * 256,
      height: rows * 256,
      channels: 3,
      background: "#f4efdf",
    },
  }).composite(tiles);
  const mapBuffer = await canvas.png().toBuffer();
  const cropLeft = Math.round((left - minX) * 256);
  const cropTop = Math.round((top - minY) * 256);
  const cropWidth = Math.max(1, Math.round((right - left) * 256));
  const cropHeight = Math.max(1, Math.round((bottom - top) * 256));
  const attribution = Buffer.from(`
    <svg width="1440" height="900" xmlns="http://www.w3.org/2000/svg">
      <rect x="900" y="856" width="540" height="44" fill="#fffdf5" fill-opacity="0.92"/>
      <text x="1422" y="884" text-anchor="end" font-family="Arial, sans-serif" font-size="18" fill="#234238">© OpenStreetMap contributors · 位置示意</text>
    </svg>
  `);

  await sharp(mapBuffer)
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .resize(1440, 900, { fit: "fill" })
    .composite([{ input: attribution, left: 0, top: 0 }])
    .webp({ quality: 80, effort: 5, smartSubsample: true })
    .toFile(path.join(outputDirectory, "guangzhou-overview-map.webp"));

  await writeFile(
    path.join(outputDirectory, "map-credit.json"),
    `${JSON.stringify({
      source: "OpenStreetMap",
      url: "https://www.openstreetmap.org/copyright",
      license: "ODbL 1.0",
      licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
      modifications: "拼接地图瓦片、裁切、缩放并转换为 WebP；地点标记由网页叠加",
      bounds,
      zoom,
      retrievedAt,
    }, null, 2)}\n`,
  );
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const source = await readFile(sourcePath, "utf8");
  const credits = extractCredits(source);

  for (let index = 0; index < credits.length; index += 4) {
    const batch = credits.slice(index, index + 4);
    const completed = await Promise.all(batch.map(preparePhoto));
    process.stdout.write(`${completed.join(", ")}\n`);
  }

  await writeFile(
    path.join(outputDirectory, "credits.json"),
    `${JSON.stringify(credits, null, 2)}\n`,
  );
  await prepareOverviewMap();
  process.stdout.write("guangzhou-overview-map.webp\n");
}

await main();
