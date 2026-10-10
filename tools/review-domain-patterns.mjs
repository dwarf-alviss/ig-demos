import { reviewBrowser } from "./review-runtime.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { patternLists } from "../shared/domain.js";
import { defaults } from "../shared/studio-state.js";
const categories = process.argv.slice(2);
const selected = categories.length
  ? categories
  : ["cakes", "flowers", "jewelry"];
await mkdir("reports/revision-4/patterns", { recursive: true });
const { browser, close } = await reviewBrowser();
const report = [];
try {
  for (const kind of selected) {
    const page = await browser.newPage({
      viewport: { width: 1500, height: 1100 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:8765/${kind}/studio.html`);
    await page.waitForFunction(() => window.studioReview?.ready(), null, {
      timeout: 90000,
    });
    await page.evaluate(() => window.studioReview.freeze());
    for (const p of patternLists[kind]) {
      const state = {
        ...defaults(kind),
        stone: undefined,
        palette: kind === "flowers" ? undefined : 0,
        pattern: p.id,
      };
      await page.evaluate((s) => window.studioReview.setState(s), state);
      await page.waitForFunction(() => window.studioReview.ready(), null, {
        timeout: 90000,
      });
      for (const pose of ["front", "top"]) {
        await page.evaluate((p) => window.studioReview.pose(p), pose);
        await page.locator("#viewer").screenshot({
          path: `reports/revision-4/patterns/${kind}-${p.id}-${pose}.jpg`,
          quality: 90,
        });
      }
      report.push({
        kind,
        pattern: p.id,
        metrics: await page.evaluate(() => window.studioReview.metrics()),
        state: await page.evaluate(() => window.studioReview.getState()),
        errors: [...errors],
      });
      console.log(kind, p.id);
    }
    await page.close();
  }
} finally {
  await close();
  await writeFile(
    "reports/revision-4/patterns/results-" + selected.join("-") + ".json",
    JSON.stringify(report, null, 2),
  );
}

// Browser pipes can stay open after the owned Chrome process exits on Windows.
process.exit(0);
