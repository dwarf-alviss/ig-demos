import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
await mkdir("shared/design-previews", { recursive: true });
for (const kind of ["cakes", "flowers", "jewelry", "fashion"])
  for (const v of ["a", "b", "c"])
    await sharp(`reports/showcase-final/${kind}-${v}-desktop.jpg`)
      .extract({ left: 0, top: 0, width: 1440, height: 900 })
      .resize(720, 450)
      .jpeg({ quality: 85 })
      .toFile(`shared/design-previews/${kind}-${v}.jpg`);
const file = "tools/build-showcase.mjs";
let source = await readFile(file, "utf8");
source = source.replace(
  'src="${kind}/${p.hero}"',
  'src="shared/design-previews/${kind}-${v}.jpg"',
);
await writeFile(file, source);
let html = await readFile("directions.html", "utf8");
const indices = {};
html = html.replace(
  /src="(cakes|flowers|jewelry|fashion)\/assets\/img\/[^"]+"/g,
  (all, kind) => {
    const v = ["a", "b", "c"][indices[kind] || 0];
    indices[kind] = (indices[kind] || 0) + 1;
    return `src="shared/design-previews/${kind}-${v}.jpg"`;
  },
);
await writeFile("directions.html", html);
console.log("Created twelve actual design previews");
