import { reviewBrowser } from "./review-runtime.mjs";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.REVIEW_URL || "http://127.0.0.1:8765";
const folder = process.env.REVIEW_OUTPUT || "reports/content-inline";
await mkdir(folder, { recursive: true });
const { browser, close } = await reviewBrowser();
const results = [];
try {
  for (const kind of ["cakes", "flowers", "jewelry", "fashion"]) {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await p.goto(base + "/" + kind + "/", { waitUntil: "networkidle" });
    const frame = p.frames().find((f) => f.url().endsWith("/studio.html"));
    await frame.waitForFunction(
      () =>
        window.studioReview?.ready() ||
        document.querySelectorAll("#look img").length === 3,
      null,
      { timeout: 90000 },
    );
    await p.locator("#create").scrollIntoViewIfNeeded();
    await p.waitForTimeout(1000);
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    assert.ok(
      await frame.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    const fit = await p
      .locator("iframe")
      .evaluate((el) => ({
        outer: el.clientHeight,
        inner: el.contentDocument.querySelector("main").getBoundingClientRect()
          .height,
      }));
    assert.ok(fit.outer >= fit.inner);
    await p
      .locator("#create")
      .screenshot({ path: folder + "/" + kind + "-mobile-studio.jpg" });
    assert.equal(await p.locator(".content-faq details").count(), 3);
    await p.locator(".content-faq summary").first().click();
    assert.ok(
      (await p.locator(".content-faq details").first().getAttribute("open")) !==
        null,
    );
    results.push({ kind, fit, overflow: false, faq: true });
    console.log(kind, "inline mobile passed");
    await p.close();
  }
  await writeFile(
    folder + "/mobile-validation.json",
    JSON.stringify(results, null, 2),
  );
} finally {
  await close();
}
