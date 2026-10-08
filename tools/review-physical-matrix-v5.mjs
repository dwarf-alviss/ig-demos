const reviewUrl = process.env.REVIEW_URL || "http://127.0.0.1:8765";
import { reviewBrowser } from "./review-runtime.mjs";
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { normalize } from "../shared/studio-state.js";
const matrix = JSON.parse(
  await readFile(
    process.env.REVIEW_MATRIX || "reports/revision-5/matrix-all.json",
    "utf8",
  ),
).map((c) => ({ ...c, key: JSON.stringify(c.state) }));
const requested = process.argv[2] || "all",
  filter = process.argv[3];
const bundleBytes = await readFile(
  process.env.REVIEW_BUNDLE || "shared/studio.bundle.js",
);
const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");
const suite = process.env.REVIEW_MATRIX?.includes("domain")
  ? "domain"
  : "native";
const directory = `reports/revision-5/combinations/${bundleHash.slice(0, 12)}/${suite}`;
await mkdir(directory, { recursive: true });
const cases = matrix.filter(
  (c) =>
    (requested === "all" || c.kind === requested) &&
    (!filter || c.label.includes(filter)),
);
const prior = new Map();
try {
  for (const line of (await readFile(`${directory}/progress.jsonl`, "utf8"))
    .trim()
    .split("\n")) {
    const r = JSON.parse(line);
    if (!r.error) prior.set(r.key, r);
  }
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const { browser, close } = await reviewBrowser();
let page,
  currentKind,
  errors = [];
const results = [];
let interrupted = false;
process.on("SIGINT", () => {
  interrupted = true;
});
try {
  for (const [i, c] of cases.entries()) {
    if (interrupted) break;
    if (prior.has(c.key)) {
      results.push({ ...prior.get(c.key), label: c.label });
      continue;
    }
    if (currentKind !== c.kind || !page) {
      if (page) await page.close();
      page = await browser.newPage({ viewport: { width: 1300, height: 950 } });
      page.setDefaultTimeout(90000);
      await page.route("**/shared/studio.bundle.js", (route) =>
        route.fulfill({
          body: bundleBytes,
          contentType: "application/javascript",
        }),
      );
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${reviewUrl}/${c.kind}/studio.html`, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      await page.waitForFunction(() => window.studioReview?.ready(), null, {
        timeout: 90000,
      });
      await page.addStyleTag({
        content:
          ".studio-workspace{display:block!important;width:1100px!important}.atelier,.stage-shell{width:1100px!important}.design-panel{display:none!important}#viewer{width:1100px!important;height:800px!important;max-height:none!important}",
      });
      const servedHash = await page.evaluate(async () => {
        const bytes = await (
          await fetch("../shared/studio.bundle.js", { cache: "no-store" })
        ).arrayBuffer();
        return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
      });
      assert.equal(
        servedHash,
        bundleHash,
        "bundle changed during review; regenerate proof for the current version",
      );
      await page.evaluate(() => window.studioReview.freeze());
      currentKind = c.kind;
    }
    errors = [];
    const id = `${c.kind}-${createHash("sha256").update(c.key).digest("hex").slice(0, 16)}`;
    const row = { ...c, id, bundleHash, poses: {} };
    try {
      await page.evaluate((s) => window.studioReview.setState(s), c.state);
      await page.waitForFunction(() => window.studioReview.ready(), null, {
        timeout: 90000,
      });
      const actual = await page.evaluate(() => window.studioReview.getState());
      assert.deepEqual(actual, normalize(c.kind, c.state), id);
      if (c.label.includes(" / verified pair ")) {
        const ids = c.label
          .split(" / verified pair ")[1]
          .split(" / ")[0]
          .split("+");
        assert.ok(
          ids.every((id) => actual.decor.includes(id) && actual.counts[id] > 0),
          "A verified pair lost a requested component: " + id,
        );
      }
      for (const pose of ["front", "side", "top", "back"]) {
        await page.evaluate((p) => window.studioReview.pose(p), pose);
        const metrics = await page.evaluate(() =>
          window.studioReview.metrics(),
        );
        assert.ok(
          metrics.framing.maxX < 0.96 && metrics.framing.maxY < 0.96,
          id,
        );
        if (c.kind === "flowers") {
          assert.equal(
            actual.pattern
              ? metrics.assembly.crown.length
              : metrics.assembly.flowers,
            Object.values(
              actual.pattern ? actual.taxonCounts : actual.counts,
            ).reduce((n, v) => n + v, 0),
          );
          for (const head of metrics.assembly.crown) {
            assert.ok(
              Math.hypot(
                head.mouthPoint[0] - metrics.assembly.centerX,
                head.mouthPoint[2],
              ) <=
                metrics.assembly.mouthRadius * 0.82 + 1e-5,
              id,
            );
            assert.ok(head.attachment.every(Number.isFinite), id);
            if (metrics.assembly.container?.startsWith("fl-vase-")) {
              const lip = metrics.assembly.lip ?? metrics.assembly.mouthLip;
              assert.ok(
                head.attachment[1] >= lip + 1 - 1e-5,
                `${id}: calyx lies below vase opening`,
              );
              assert.ok(
                Math.abs(head.mouthPoint[1] - lip - 0.16) < 1e-5,
                `${id}: stem enters vase below its opening`,
              );
            }
          }
        }
        row.poses[pose] = { ...metrics, image: `${id}-${pose}.jpg` };
        await page
          .locator("#viewer")
          .screenshot({ path: `${directory}/${id}-${pose}.jpg`, quality: 88 });
      }
      assert.deepEqual(errors, [], id);
    } catch (e) {
      row.error = e.message;
      console.log("FAILED", id, c.label, e.message.slice(0, 160));
      await page.close();
      page = null;
      currentKind = null;
    }
    results.push(row);
    await appendFile(`${directory}/progress.jsonl`, JSON.stringify(row) + "\n");
    if (i % 25 === 0) console.log(requested, i + 1, "/", cases.length);
    if (i % 50 === 0)
      await writeFile(
        `${directory}/results-${requested}.json`,
        JSON.stringify(
          { bundleHash, expected: cases.length, completed: false, results },
          null,
          2,
        ),
      );
  }
} finally {
  await writeFile(
    `${directory}/results-${requested}${filter ? "-filtered" : ""}.json`,
    JSON.stringify(
      {
        bundleHash,
        expected: cases.length,
        completed: results.length === cases.length,
        failures: results.filter((r) => r.error).length,
        results,
      },
      null,
      2,
    ),
  );
  await close();
}
console.log(
  "Completed",
  results.length,
  "Failures",
  results.filter((r) => r.error).length,
);
process.exit(results.some((r) => r.error) ? 1 : 0);
