import { reviewBrowser } from "./review-runtime.mjs";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, appendFile } from "node:fs/promises";
import { catalogue } from "../shared/catalogue.js";
import { patternLists, forms } from "../shared/domain.js";
import { defaults, normalize } from "../shared/studio-state.js";
import { compatibleStones } from "../shared/jewelry-rules.js";
const { browser, close } = await reviewBrowser(),
  results = [];
const buildHash = createHash("sha256")
  .update(await readFile("shared/studio.bundle.js"))
  .digest("hex");
const progressFile = "reports/revision-4/stress/progress.jsonl";
try {
  for (const line of (await readFile(progressFile, "utf8"))
    .trim()
    .split("\n")) {
    const row = JSON.parse(line);
    if (row.buildHash === buildHash) {
      const i = results.findIndex(
        (r) => r.kind === row.result.kind && r.id === row.result.id,
      );
      if (i < 0) results.push(row.result);
      else results[i] = row.result;
    }
  }
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const completed = new Set(
  results.filter((r) => r.visual).map((r) => r.kind + ":" + r.id),
);
await mkdir("reports/revision-4/stress", { recursive: true });
try {
  for (const kind of ["cakes", "flowers", "jewelry"]) {
    const page = await browser.newPage({
        viewport: { width: 1200, height: 900 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:8765/${kind}/studio.html`);
    await page.waitForFunction(() => window.studioReview?.ready());
    await page.evaluate(() => window.studioReview.freeze());
    const cases = [];
    if (kind === "jewelry") {
      for (const stone of catalogue.filter(
        (a) => a.project === kind && a.category === "stone",
      )) {
        const pattern = patternLists[kind].find((p) =>
          compatibleStones({ pattern: p.id }).some((a) => a.id === stone.id),
        );
        assert.ok(pattern, stone.id);
        cases.push({
          id: stone.id,
          state: { ...defaults(kind), pattern: pattern.id, stone: stone.id },
        });
      }
      for (const pattern of patternLists[kind])
        for (const palette of [0, 1, 2, 3, 4])
          for (const finish of ["polished", "satin", "brushed", "hammered"])
            cases.push({
              id: `${pattern.id}-${palette}-${finish}`,
              state: {
                ...defaults(kind),
                stone: undefined,
                pattern: pattern.id,
                palette,
                finish,
              },
            });
    } else if (kind === "flowers") {
      const packs = catalogue.filter(
          (a) => a.project === kind && a.category === "pack",
        ),
        ribbons = [
          null,
          ...catalogue
            .filter((a) => a.project === kind && a.category === "ribbon")
            .map((a) => a.id),
        ];
      for (const pattern of patternLists[kind]) {
        const form = forms[pattern.form],
          packIds = form.packaging.includes("ribbon")
            ? [null]
            : form.packaging.includes("box")
              ? ["fl-wrap-hatbox-round"]
              : form.packaging.includes("basket")
                ? ["fl-wrap-basket-rattan"]
                : packs
                    .filter(
                      (a) =>
                        !a.id.includes("hatbox") && !a.id.includes("basket"),
                    )
                    .map((a) => a.id);
        for (const pack of packIds)
          for (const ribbon of ribbons)
            for (const palette of [0, 1, 2, 3, 4]) {
              const state = {
                ...defaults(kind),
                pattern: pattern.id,
                pack,
                ribbon,
                palette,
                bouquetSize: 29,
              };
              const initial = normalize(kind, state).taxonCounts;
              state.taxonCounts = Object.fromEntries(
                Object.entries(initial).map(([id, n]) => [id, n + 5]),
              );
              cases.push({
                id: `${pattern.id}-${pack || "bound"}-${ribbon || "plain"}-${palette}`,
                state,
              });
            }
      }
    } else
      for (const pattern of patternLists[kind])
        for (const palette of kind === "flowers"
          ? [0, 1, 2, 3, 4]
          : [0, 1, 2, 3]) {
          const state = {
            ...defaults(kind),
            pattern: pattern.id,
            palette,
            tiers: 3,
            pieces: 6,
            bouquetSize: 29,
          };
          if (kind === "cakes") {
            state.foodDecor = pattern.compatibleDecor;
            state.foodCounts = Object.fromEntries(
              pattern.compatibleDecor.map((id) => [id, 12]),
            );
          }
          cases.push({ id: `${pattern.id}-${palette}-maximum`, state });
        }
    for (const [index, c] of cases.entries()) {
      if (completed.has(kind + ":" + c.id)) continue;
      const expected = normalize(kind, c.state);
      await page.evaluate((s) => window.studioReview.setState(s), c.state);
      await page.waitForFunction(() => window.studioReview.ready(), null, {
        timeout: 90000,
      });
      assert.deepEqual(
        await page.evaluate(() => window.studioReview.getState()),
        expected,
        c.id,
      );
      const metrics = await page.evaluate(() => window.studioReview.metrics());
      assert.ok(metrics.assembly, c.id);
      assert.ok(
        metrics.framing.maxX < 0.95 && metrics.framing.maxY < 0.95,
        `${c.id}: clipped framing`,
      );
      if (kind === "flowers")
        assert.ok(metrics.drawCalls < 2000, `${c.id}: excessive draw calls`);
      if (kind === "flowers" && metrics.assembly.container) {
        const a = metrics.assembly;
        for (const flower of a.crown)
          assert.ok(
            Math.hypot(
              flower.mouthPoint[0] - a.centerX,
              flower.mouthPoint[2],
            ) <=
              a.mouthRadius * 0.82 + 1e-6,
            c.id,
          );
      }
      assert.deepEqual(errors, [], c.id);
      await page.evaluate(() => window.studioReview.pose("front"));
      const pixels = await page
        .locator("#viewer")
        .screenshot({ type: "jpeg", quality: 86 });
      const stats = await sharp(pixels).stats(),
        image = await sharp(pixels).metadata();
      assert.ok(
        stats.channels.slice(0, 3).some((channel) => channel.stdev > 5),
        `${c.id}: empty or invisible scene`,
      );
      await writeFile(`reports/revision-4/stress/${kind}-${c.id}.jpg`, pixels);
      const result = {
        kind,
        id: c.id,
        state: expected,
        metrics,
        visual: {
          width: image.width,
          height: image.height,
          channelDeviation: stats.channels
            .slice(0, 3)
            .map((channel) => channel.stdev),
        },
      };
      const previous = results.findIndex(
        (r) => r.kind === kind && r.id === c.id,
      );
      if (previous < 0) results.push(result);
      else results[previous] = result;
      await appendFile(
        progressFile,
        JSON.stringify({ buildHash, result }) + "\n",
      );
      if (index % 50 === 0) console.log(kind, index + 1, "/", cases.length);
    }
    await page.evaluate(() => {
      window.contextTest = document
        .querySelector("canvas")
        .getContext("webgl2")
        .getExtension("WEBGL_lose_context");
      window.contextTest.loseContext();
    });
    await page.waitForTimeout(250);
    await page.evaluate(() => window.contextTest.restoreContext());
    await page.waitForFunction(() => window.studioReview.ready(), null, {
      timeout: 90000,
    });
    assert.deepEqual(errors, []);
    await page.close();
  }
} finally {
  await writeFile(
    "reports/revision-4/stress/results.json",
    JSON.stringify(
      {
        buildHash,
        completedAt: new Date().toISOString(),
        cases: results.length,
        results,
      },
      null,
      2,
    ),
  );
  await close();
}

// Browser pipes can stay open after the owned Chrome process exits on Windows.
process.exit(0);
