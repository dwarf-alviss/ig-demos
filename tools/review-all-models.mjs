import { chromium } from "@playwright/test";
import { catalogue } from "../shared/catalogue.js";
import { defaults, toggleAsset } from "../shared/studio-state.js";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("reports/revision-2/assembled", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const only = process.argv.slice(2);
const records = only.length
  ? JSON.parse(
      await readFile("reports/revision-2/assembled-review.json", "utf8"),
    ).filter((r) => !only.includes(r.id))
  : [];
for (const kind of ["cakes", "flowers", "jewelry"]) {
  if (
    only.length &&
    !catalogue.some((a) => a.project === kind && only.includes(a.id))
  )
    continue;
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.on("pageerror", (e) => console.log("ERROR", e.message));
  await p.goto(`http://127.0.0.1:8765/${kind}/studio.html`);
  await p.waitForFunction(() => window.studioReview?.ready(), {
    timeout: 60000,
  });
  for (const [i, asset] of catalogue
    .filter((a) => a.project === kind && (!only.length || only.includes(a.id)))
    .entries()) {
    let state = defaults(kind);
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
      if (asset.category === "finding" || asset.category === "setting")
        state = toggleAsset(kind, state, asset.id);
      else state[asset.category] = asset.id;
    }
    await p.evaluate((s) => window.studioReview.setState(s), state);
    await p.waitForFunction(() => window.studioReview.ready(), {
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
        path: `reports/revision-2/assembled/${asset.id}${pose === "front" ? "" : "-" + pose}.jpg`,
        type: "jpeg",
        quality: 85,
      });
    }
    records.push({
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
  "reports/revision-2/assembled-review.json",
  JSON.stringify(records, null, 2),
);
for (const kind of ["cakes", "flowers", "jewelry"]) {
  const filtered = records.filter((r) =>
    r.id.startsWith(
      kind === "cakes" ? "bk-" : kind === "flowers" ? "fl-" : "jw-",
    ),
  );
  for (let batch = 0; batch < Math.ceil(filtered.length / 30); batch++) {
    const rows = filtered.slice(batch * 30, batch * 30 + 30);
    const p = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
    });
    await p.setContent(
      `<body style="margin:0;background:#f8f6f0;display:grid;grid-template-columns:repeat(5,1fr);font:11px system-ui;gap:7px">${rows.map((r) => `<figure style="margin:0"><img width="310" src="http://127.0.0.1:8765/reports/revision-2/assembled/${r.id}.jpg"><figcaption>${r.id}</figcaption></figure>`).join("")}</body>`,
    );
    await p
      .locator("img")
      .evaluateAll((imgs) => Promise.all(imgs.map((i) => i.decode())));
    await p.screenshot({
      path: `reports/revision-2/${kind}-assemblies-${batch}.jpg`,
      fullPage: true,
      type: "jpeg",
      quality: 90,
    });
    await p.close();
  }
}
await browser.close();
console.log("All", records.length, "models assembled and photographed");
