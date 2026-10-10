import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
await mkdir("shared/design-previews", { recursive: true });
for (const kind of ["cakes", "flowers", "jewelry", "fashion"])
  for (const v of ["a", "b", "c"])
    await sharp(`reports/concepts-structural/${kind}-${v}-desktop.jpg`)
      .extract({ left: 0, top: 0, width: 1440, height: 900 })
      .resize(720, 450)
      .jpeg({ quality: 85 })
      .toFile(`shared/design-previews/${kind}-${v}.jpg`);
console.log("Created twelve actual concept previews");
