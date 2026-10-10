import { reviewBrowser } from "./review-runtime.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.REVIEW_URL || "http://127.0.0.1:8765";
const { browser, close } = await reviewBrowser();
const folder = process.env.REVIEW_OUTPUT || "reports/showcase";
await mkdir(folder, { recursive: true });
const results = [];
try {
  for (const kind of ["cakes", "flowers", "jewelry", "fashion"])
    for (const v of process.env.REVIEW_RECOMMENDED_ONLY
      ? ["a"]
      : ["a", "b", "c"]) {
      const page = await browser.newPage({
          viewport: { width: 1440, height: 1050 },
        }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const path = `${kind}/${v === "a" ? "index" : `concept-${v}`}.html`;
      await page.goto(`${base}/${path}`, { waitUntil: "networkidle" });
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(await page.locator(".piece").count(), 3);
      assert.equal(
        await page.locator(".concept-bar [aria-current]").count(),
        1,
      );
      assert.ok(
        await page.evaluate(() =>
          [...document.images].every((i) => i.complete && i.naturalWidth > 0),
        ),
      );
      await page.screenshot({
        path: `${folder}/${kind}-${v}-desktop.jpg`,
        fullPage: true,
        quality: 80,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page.screenshot({
        path: `${folder}/${kind}-${v}-mobile.jpg`,
        fullPage: true,
        quality: 75,
      });
      if (v === "a") {
        await page.setViewportSize({ width: 1440, height: 1050 });
        await page.locator("[data-load-studio]").click();
        const frame = page.frameLocator(".studio-mount iframe");
        if (kind !== "fashion") {
          await frame.locator("#viewer canvas").waitFor({ timeout: 90000 });
          await page
            .frames()
            .find((f) => f.url().endsWith("/studio.html"))
            .waitForFunction(() => window.studioReview?.ready(), null, {
              timeout: 90000,
            });
        } else
          await frame
            .locator("#choices button")
            .first()
            .waitFor({ timeout: 30000 });
        assert.equal(
          await page.locator(".studio-placeholder").isVisible(),
          false,
        );
        await page
          .locator(".studio-mount")
          .screenshot({ path: `${folder}/${kind}-embedded.jpg`, quality: 80 });
      }
      assert.deepEqual(errors, []);
      results.push({
        kind,
        variant: v,
        path,
        desktop: true,
        mobile: true,
        embedded: v === "a",
      });
      console.log(kind, v, "passed");
      await page.close();
    }
  const page = await browser.newPage();
  await page.goto(`${base}/directions.html`);
  assert.equal(await page.locator(".direction").count(), 12);
  await page.close();
  await writeFile(
    `${folder}/validation.json`,
    JSON.stringify({ base, results, concepts: results.length }, null, 2) + "\n",
  );
} finally {
  await close();
}
