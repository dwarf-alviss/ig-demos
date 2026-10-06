import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("shared/presets", { recursive: true });
await mkdir("reports/revision-2", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = [];
for (const kind of ["cakes", "flowers", "jewelry"]) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  p.on("pageerror", (e) => console.log(kind, "ERROR", e.message));
  await p.goto(`http://127.0.0.1:8765/${kind}/studio.html`);
  await p.waitForFunction(() => window.studioReview?.ready(), {
    timeout: 60000,
  });
  for (let i = 0; i < 3; i++) {
    await p.evaluate((i) => window.studioReview.preset(i), i);
    await p.waitForFunction(() => window.studioReview.ready(), {
      timeout: 60000,
    });
    await p
      .locator("#viewer")
      .screenshot({
        path: `shared/presets/${kind}-${i}.jpg`,
        type: "jpeg",
        quality: 90,
      });
    await p.screenshot({
      path: `reports/revision-2/${kind}-${i}.jpg`,
      fullPage: true,
      type: "jpeg",
      quality: 90,
    });
    report.push({
      kind,
      preset: i,
      metrics: await p.evaluate(() => window.studioReview.metrics()),
    });
    console.log(kind, "preset", i, "rendered");
  }
  await p.close();
}
await browser.close();
await writeFile(
  "reports/revision-2/preset-metrics.json",
  JSON.stringify(report, null, 2),
);
