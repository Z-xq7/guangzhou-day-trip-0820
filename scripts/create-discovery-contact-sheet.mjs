import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const sourceDirectory = new URL("../public/images/discovery/", import.meta.url);
const files = (await readdir(sourceDirectory))
  .filter((file) => /^\d{2}-.+\.webp$/.test(file))
  .sort();
const cellWidth = 240;
const cellHeight = 184;
const columns = 5;
const rows = Math.ceil(files.length / columns);
const composites = [];

for (const [index, file] of files.entries()) {
  const image = await sharp(fileURLToPath(new URL(file, sourceDirectory)))
    .resize(cellWidth, 160, { fit: "cover" })
    .toBuffer();
  const label = Buffer.from(`
    <svg width="${cellWidth}" height="${cellHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect y="160" width="${cellWidth}" height="24" fill="#173f35"/>
      <text x="8" y="178" font-family="Arial, sans-serif" font-size="13" fill="#fff">${file.replace(".webp", "")}</text>
    </svg>
  `);
  composites.push({ input: image, left: (index % columns) * cellWidth, top: Math.floor(index / columns) * cellHeight });
  composites.push({ input: label, left: (index % columns) * cellWidth, top: Math.floor(index / columns) * cellHeight });
}

await sharp({
  create: {
    width: columns * cellWidth,
    height: rows * cellHeight,
    channels: 3,
    background: "#f7f1df",
  },
})
  .composite(composites)
  .webp({ quality: 86 })
  .toFile("/private/tmp/guangzhou-discovery-contact-sheet.webp");
