import { createHash } from "node:crypto";
import { reviewBrowser } from "./review-runtime.mjs";
import { catalogue } from "../shared/catalogue.js";
import { defaults, toggleAsset } from "../shared/studio-state.js";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("reports/revision-5/assembled", { recursive: true });
const { browser, close } = await reviewBrowser();
const bundleBytes = await readFile(
  process.env.REVIEW_BUNDLE || "shared/studio.bundle.js",
);
const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");
const only = process.argv.slice(2);
const records = only.length
  ? JSON.parse(
      await readFile("reports/revision-5/assembled-review.json", "utf8"),
    ).filter((r) => !only.includes(r.id))
  : [];
try {
  for (const kind of ["cakes", "flowers", "jewelry"]) {
    if (
      only.length &&
      !catalogue.some((a) => a.project === kind && only.includes(a.id))
    )
      continue;
    const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await p.route("**/shared/studio.bundle.js", (route) =>
      route.fulfill({
        body: bundleBytes,
        contentType: "application/javascript",
      }),
    );
    p.on("pageerror", (e) => console.log("ERROR", e.message));
    await p.goto(`http://127.0.0.1:8765/${kind}/studio.html`);
    await p.addStyleTag({
      content:
        ".studio-workspace{display:block!important;width:1100px!important}.atelier,.stage-shell{width:1100px!important}.design-panel{display:none!important}#viewer{width:1100px!important;height:800px!important;max-height:none!important}",
    });
    await p.waitForFunction(() => window.studioReview?.ready(), null, {
      timeout: 60000,
    });
    await p.evaluate(() => window.studioReview.freeze());
    for (const [i, asset] of catalogue
      .filter(
        (a) => a.project === kind && (!only.length || only.includes(a.id)),
      )
      .entries()) {
      let state = { ...defaults(kind), pattern: null };
      if (kind === "cakes") {
        state.decor = [];
        if (asset.category === "decor") {
          state.decor = [asset.id];
          state.counts = { [asset.id]: asset.role === "sprinkle" ? 10 : 3 };
        } else state[asset.category] = asset.id;
      } else if (kind === "flowers") {
        state.green = [];
        state.ribbon = null;
        if (asset.category === "flowers") {
          state.flowers = [asset.id];
          state.counts = { [asset.id]: 7 };
        } else if (asset.category === "green") state.green = [asset.id];
        else state[asset.category] = asset.id;
      } else {
        if (asset.category === "stone") state.base = "jw-base-band-plain";
        if (asset.category === "finding" || asset.category === "setting")
          state = toggleAsset(kind, state, asset.id);
        else state[asset.category] = asset.id;
      }
      await p.evaluate((s) => window.studioReview.setState(s), state);
      await p.waitForFunction(() => window.studioReview.ready(), null, {
        timeout: 60000,
      });
      const poses = {};
      for (const pose of ["front", "side", "top"]) {
        await p.evaluate((pose) => window.studioReview.pose(pose), pose);
        poses[pose] = await p.evaluate(() => window.studioReview.metrics());
        assert.ok(
          poses[pose].framing.maxX < 1 && poses[pose].framing.maxY < 1,
          asset.id + " / " + pose,
        );
        await p.locator("#viewer").screenshot({
          path: `reports/revision-5/assembled/${asset.id}${pose === "front" ? "" : "-" + pose}.jpg`,
          type: "jpeg",
          quality: 85,
        });
      }
      records.push({
        bundleHash,
        id: asset.id,
        category: asset.category,
        state: await p.evaluate(() => window.studioReview.getState()),
        metrics: await p.evaluate(() => window.studioReview.metrics()),
        poses,
      });
      if (i % 12 === 0) console.log(kind, "reviewed", i + 1);
    }
    await p.close();
  }
  await writeFile(
    "reports/revision-5/assembled-review.json",
    JSON.stringify(records, null, 2),
  );
} finally {
  await close();
}
process.exit(0);
