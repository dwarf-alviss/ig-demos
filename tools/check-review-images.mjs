import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
// Pixel checks flag blank/clipped renders for inspection; they cannot certify mesh collisions.
const results = [],
  summary = {};
for (const kind of ["cakes", "flowers", "jewelry"]) {
  const records = JSON.parse(
    await readFile(`reports/revision-3/results-${kind}.json`, "utf8"),
  );
  for (const r of records) {
    if (r.error) continue;
    for (const pose of kind === "cakes"
      ? ["front"]
      : kind === "flowers"
        ? ["front", "back"]
        : ["front", "top"]) {
      const { data, info } = await sharp(
        `reports/revision-3/combinations/${r.id}-${pose}.jpg`,
      )
        .resize({ width: 160 })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const { width: w, height: h, channels: c } = info;
      const pixel = (x, y) => [0, 1, 2].map((k) => data[(y * w + x) * c + k]);
      const corners = [
        pixel(3, 3),
        pixel(w - 4, 3),
        pixel(3, h - 4),
        pixel(w - 4, h - 4),
      ];
      const backgrounds = corners.map((rgb) => rgb);
      let n = 0,
        x0 = w,
        y0 = h,
        x1 = 0,
        y1 = 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const rgb = pixel(x, y),
            distance = Math.min(
              ...backgrounds.map((bg) =>
                rgb.reduce((s, v, i) => s + Math.abs(v - bg[i]), 0),
              ),
            );
          if (distance < 48) continue;
          n++;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      const ratio = n / (w * h),
        flags = [];
      if (ratio < 0.003) flags.push("low foreground contrast");
      if (ratio > 0.85) flags.push("unexpected full-frame foreground");
      if (
        n &&
        (Math.min(x0, y0, w - 1 - x1) < 2 ||
          (h - 1 - y1 < 2 && r.metrics?.framing.maxY >= 0.98))
      )
        flags.push("foreground near image boundary");
      results.push({
        id: r.id,
        pose,
        foregroundRatio: +ratio.toFixed(4),
        pixelBounds: [x0, y0, x1, y1],
        flags,
      });
    }
  }
  summary[kind] = {
    images: results.filter((r) => r.id.startsWith(kind + "-")).length,
    flagged: results.filter(
      (r) => r.id.startsWith(kind + "-") && r.flags.length,
    ).length,
  };
}
await writeFile(
  "reports/revision-3/image-checks.json",
  JSON.stringify(
    {
      method:
        "Foreground color difference from four sampled background corners at 160px. Review candidates only; no proof of topology or visual perfection.",
      summary,
      images: results,
    },
    null,
    2,
  ),
);
console.log(summary);
