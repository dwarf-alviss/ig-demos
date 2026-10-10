import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile, stat } from "node:fs/promises";
const rows = JSON.parse(
  await readFile("reports/revision-3/gallery-data.json", "utf8"),
);
for (const r of rows)
  for (const pose of r.kind === "cakes"
    ? ["front"]
    : r.kind === "flowers"
      ? ["front", "back"]
      : ["front", "top"])
    await stat(`reports/revision-3/combinations/${r.id}-${pose}.jpg`);
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  p = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto("http://127.0.0.1:8765/reports/revision-3/gallery.html");
await p.waitForFunction(
  () => document.querySelectorAll("figure").length === 24,
);
assert.equal(await p.locator("figure").count(), 24);
await p.locator("#next").click();
assert.ok((await p.locator("#page").textContent()).startsWith("2 /"));
await p.locator("#kind").selectOption("jewelry");
await p.locator("#pose").selectOption("top");
await p.locator("#search").fill("jw-set-pave-band");
await p.waitForFunction(() =>
  document
    .querySelector("figure img")
    ?.getAttribute("src")
    .endsWith("-top.jpg"),
);
const first = rows.find(
  (r) => r.kind === "jewelry" && r.label.includes("jw-set-pave-band"),
);
const popupPromise = p.waitForEvent("popup");
await p.locator("[data-open]").first().click();
const popup = await popupPromise;
await popup.waitForFunction(() => window.studioReview?.ready(), {
  timeout: 60000,
});
assert.deepEqual(
  await popup.evaluate(() => window.studioReview.getState()),
  first.state,
);
await popup.close();
await p.locator("#kind").selectOption("flowers");
await p.locator("#pose").selectOption("back");
await p.locator("#search").fill("native colors");
await p.waitForFunction(
  () => document.querySelectorAll("figure").length === 24,
);
assert.ok(
  (await p.locator("figure img").first().getAttribute("src")).endsWith(
    "-back.jpg",
  ),
);
await p.screenshot({
  path: "reports/revision-3/gallery-desktop.jpg",
  fullPage: true,
  quality: 80,
});
await p.setViewportSize({ width: 390, height: 844 });
assert.equal(
  await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
);
await p.screenshot({
  path: "reports/revision-3/gallery-mobile.jpg",
  fullPage: true,
  quality: 80,
});
assert.deepEqual(errors, []);
await browser.close();
await writeFile(
  "reports/revision-3/gallery-checks.json",
  JSON.stringify(
    {
      configurations: rows.length,
      checks:
        "all screenshot files exist; pagination; project/search/pose filters; reopen exact state; mobile overflow",
      errors,
    },
    null,
    2,
  ),
);
console.log("Gallery checks passed", rows.length);
