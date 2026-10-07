import { reviewBrowser } from "./review-runtime.mjs";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { defaults, normalize } from "../shared/studio-state.js";
let baseline = [];
try {
  baseline = JSON.parse(
    await readFile("reports/revision-4/performance.json", "utf8"),
  );
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const states = [
  ["autumn", "fl-wrap-matte-sleeve"],
  ["garden-pink", "fl-vase-glass-cylinder"],
].map(([pattern, pack]) => {
  const state = {
    ...defaults("flowers"),
    pattern,
    pack,
    ribbon: null,
    palette: 1,
    bouquetSize: 29,
  };
  const initial = normalize("flowers", state).taxonCounts;
  state.taxonCounts = Object.fromEntries(
    Object.entries(initial).map(([id, n]) => [id, n + 5]),
  );
  const id = `${pattern}-${pack}-plain-1`;
  return {
    id,
    state,
    metrics: { drawCalls: baseline.find((r) => r.id === id)?.before ?? null },
  };
});
const { browser, close } = await reviewBrowser(),
  results = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
  });
  await page.goto("http://127.0.0.1:8765/flowers/studio.html");
  await page.waitForFunction(() => window.studioReview?.ready());
  await page.evaluate(() => window.studioReview.freeze());
  for (const previous of states) {
    assert.ok(previous);
    const start = Date.now();
    await page.evaluate(
      (state) => window.studioReview.setState(state),
      previous.state,
    );
    await page.waitForFunction(() => window.studioReview.ready(), null, {
      timeout: 90000,
    });
    const metrics = await page.evaluate(() => window.studioReview.metrics());
    assert.ok(
      metrics.drawCalls < 1600,
      `${previous.id}: ${metrics.drawCalls} draw calls`,
    );
    results.push({
      id: previous.id,
      before: previous.metrics.drawCalls,
      after: metrics.drawCalls,
      triangles: metrics.triangles,
      buildMs: Date.now() - start,
    });
    console.log(results.at(-1));
  }
} finally {
  await writeFile(
    "reports/revision-4/performance.json",
    JSON.stringify(results, null, 2),
  );
  await close();
}
process.exit(0);
