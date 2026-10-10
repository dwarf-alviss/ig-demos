import { reviewBrowser } from "./review-runtime.mjs";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { catalogue, byId } from "../shared/catalogue.js";
import { defaults } from "../shared/studio-state.js";
const out = "reports/revision-4/containers";
await mkdir(out, { recursive: true });
const ribbons = [
  null,
  ...catalogue
    .filter((a) => a.project === "flowers" && a.category === "ribbon")
    .map((a) => a.id),
];
const cases = [];
for (const pack of catalogue.filter(
  (a) => a.project === "flowers" && a.category === "pack",
))
  for (const ribbon of ribbons)
    cases.push({
      id: pack.id + "-" + (ribbon || "unadorned"),
      pattern: pack.id.includes("hatbox")
        ? "white-box"
        : pack.id.includes("basket")
          ? "summer-basket"
          : "garden-pink",
      pack: pack.id,
      ribbon,
    });
for (const pattern of ["ivory-bridal", "bridal-cascade"])
  for (const ribbon of ribbons)
    cases.push({
      id: pattern + "-" + (ribbon || "unadorned"),
      pattern,
      ribbon,
    });
const { browser, close } = await reviewBrowser(),
  report = [];
try {
  const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8765/flowers/studio.html");
  await page.waitForFunction(() => window.studioReview?.ready());
  await page.evaluate(() => window.studioReview.freeze());
  for (const c of cases) {
    await page.evaluate((s) => window.studioReview.setState(s), {
      ...defaults("flowers"),
      ...c,
      bouquetSize: 29,
      palette: 1,
    });
    await page.waitForFunction(() => window.studioReview.ready(), null, {
      timeout: 90000,
    });
    const metrics = await page.evaluate(() => window.studioReview.metrics()),
      a = metrics.assembly;
    assert.deepEqual(errors, [], c.id);
    if (a.container)
      for (const flower of a.crown) {
        const p = flower.mouthPoint;
        assert.ok(
          Math.hypot(p[0] - a.centerX, p[2]) <= a.mouthRadius * 0.82 + 1e-6,
          c.id,
        );
        assert.ok(p[1] > a.mouthLip);
      }
    for (const pose of ["front", "back", "top"]) {
      await page.evaluate((p) => window.studioReview.pose(p), pose);
      await page
        .locator("#viewer")
        .screenshot({ path: `${out}/${c.id}-${pose}.jpg`, quality: 86 });
    }
    report.push({
      case: c,
      state: await page.evaluate(() => window.studioReview.getState()),
      metrics,
    });
    await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
    console.log(c.id);
  }
  await page.close();
} finally {
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
  await close();
}
for (const pose of ["front", "back", "top"]) {
  const composite = [];
  for (const [i, c] of cases.entries()) {
    composite.push({
      input: await sharp(`${out}/${c.id}-${pose}.jpg`)
        .resize(300, 180, { fit: "cover" })
        .toBuffer(),
      left: (i % 4) * 300,
      top: Math.floor(i / 4) * 210,
    });
    const title =
      (byId[c.pack]?.name || c.pattern) +
      " / " +
      (byId[c.ribbon]?.name || "Без банта");
    composite.push({
      input: Buffer.from(
        `<svg width="300" height="30"><text x="6" y="20" font-size="11" font-family="Arial">${title.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</text></svg>`,
      ),
      left: (i % 4) * 300,
      top: Math.floor(i / 4) * 210 + 180,
    });
  }
  await sharp({
    create: {
      width: 1200,
      height: Math.ceil(cases.length / 4) * 210,
      channels: 3,
      background: "#eee9e1",
    },
  })
    .composite(composite)
    .jpeg({ quality: 90 })
    .toFile(out + "/contact-" + pose + ".jpg");
}

// Browser pipes can stay open after the owned Chrome process exits on Windows.
process.exit(0);
