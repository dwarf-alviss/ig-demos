import { reviewBrowser } from "./review-runtime.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { patternLists } from "../shared/domain.js";
import { defaults } from "../shared/studio-state.js";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const bundleBytes = await readFile(
  process.env.REVIEW_BUNDLE || "shared/studio.bundle.js",
);
const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");
const only = process.argv.slice(2);
const requestedLabel = only.join("-") || "all";
const resultLabel =
  process.env.REVIEW_LABEL ||
  (requestedLabel.length > 120
    ? createHash("sha256").update(requestedLabel).digest("hex").slice(0, 16)
    : requestedLabel);
const directory = "reports/revision-5/patterns";
await mkdir(directory, { recursive: true });
const { browser, close } = await reviewBrowser(),
  results = [];
try {
  for (const kind of ["flowers", "cakes", "jewelry"]) {
    const patterns = patternLists[kind].filter(
      (p) => !only.length || only.includes(p.id),
    );
    if (!patterns.length) continue;
    const page = await browser.newPage({
        viewport: { width: 1500, height: 1100 },
      }),
      errors = [];
    await page.route("**/shared/studio.bundle.js", (route) =>
      route.fulfill({
        body: bundleBytes,
        contentType: "application/javascript",
      }),
    );
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:8765/${kind}/studio.html`);
    await page.addStyleTag({
      content:
        ".studio-workspace{display:block!important;width:1200px!important}.atelier,.stage-shell{width:1200px!important}.design-panel{display:none!important}#viewer {width:1200px!important;height:900px!important;max-height:none!important}",
    });
    await page.waitForFunction(() => window.studioReview?.ready(), null, {
      timeout: 90000,
    });
    await page.evaluate(() => window.studioReview.freeze());
    for (const pattern of patterns) {
      await page.evaluate((s) => window.studioReview.setState(s), {
        ...defaults(kind),
        pattern: pattern.id,
        stone: undefined,
        palette: kind === "flowers" ? undefined : 0,
      });
      await page.waitForFunction(() => window.studioReview.ready(), null, {
        timeout: 90000,
      });
      const poses = {};
      for (const pose of ["front", "side", "top", "back"]) {
        await page.evaluate((p) => window.studioReview.pose(p), pose);
        await page.locator("#viewer").screenshot({
          path: `${directory}/${kind}-${pattern.id}-${pose}.jpg`,
          quality: 94,
        });
        poses[pose] = await page.evaluate(() => window.studioReview.metrics());
      }
      results.push({
        bundleHash,
        kind,
        pattern: pattern.id,
        state: await page.evaluate(() => window.studioReview.getState()),
        poses,
        errors: [...errors],
      });
      console.log(kind, pattern.id);
    }
    await page.close();
  }
} finally {
  try {
    await writeFile(
      `${directory}/results-${resultLabel}.json`,
      JSON.stringify(results, null, 2),
    );
  } finally {
    await close();
  }
}
process.exit(0);
