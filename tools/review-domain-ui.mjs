import { reviewBrowser } from "./review-runtime.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("reports/revision-4/pages", { recursive: true });
const { browser, close } = await reviewBrowser(),
  results = [];
const wait = (p) =>
  p.waitForFunction(() => window.studioReview?.ready(), null, {
    timeout: 90000,
  });
try {
  for (const kind of ["cakes", "flowers", "jewelry"]) {
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1100 },
      }),
      errors = [],
      missing = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400 && r.url().includes("127.0.0.1"))
        missing.push([r.status(), r.url()]);
    });
    await page.goto(`http://127.0.0.1:8765/${kind}/studio.html`);
    await wait(page);
    const original = await page.evaluate(() => window.studioReview.getState());
    assert.ok(original.pattern);
    await page.locator("[data-pattern]").nth(1).click();
    await wait(page);
    assert.notEqual(
      (await page.evaluate(() => window.studioReview.getState())).pattern,
      original.pattern,
    );
    await page.locator("#undo").click();
    await wait(page);
    assert.deepEqual(
      await page.evaluate(() => window.studioReview.getState()),
      original,
    );
    await page.locator("#redo").click();
    await wait(page);
    await page.reload();
    await wait(page);
    assert.notEqual(
      (await page.evaluate(() => window.studioReview.getState())).pattern,
      original.pattern,
    );
    await page.locator("#reset").click();
    await wait(page);
    if (kind === "cakes") {
      await page.locator('[data-category="decor"]').click();
      const food = page.locator("[data-food]").last();
      await food.click();
      await wait(page);
      assert.ok(
        (await page.evaluate(() => window.studioReview.getState())).foodDecor
          .length,
      );
    }
    if (kind === "flowers") {
      await page.locator('[data-config="bouquetSize"]').selectOption("29");
      await wait(page);
      assert.equal(
        Object.values(
          (await page.evaluate(() => window.studioReview.getState()))
            .taxonCounts,
        ).reduce((n, v) => n + v, 0),
        29,
      );
    }
    if (kind === "jewelry") {
      await page.locator('[data-palette="4"]').click();
      await wait(page);
      await page.locator('[data-config="finish"]').selectOption("satin");
      await wait(page);
      assert.equal(
        (await page.evaluate(() => window.studioReview.getState())).finish,
        "satin",
      );
    }
    await page.locator('[data-category="pattern"]').click();
    await page.screenshot({
      path: `reports/revision-4/pages/${kind}-desktop.jpg`,
      quality: 90,
      fullPage: true,
    });
    const state = await page.evaluate(() => window.studioReview.getState());
    await page.locator("#add-cart").click();
    await page.waitForFunction(
      () => !document.querySelector("#cart-link").hidden,
    );
    await page.goto(`http://127.0.0.1:8765/${kind}/cart.html`);
    await page.locator(".edit-design").first().click();
    await wait(page);
    assert.deepEqual(
      await page.evaluate(() => window.studioReview.getState()),
      state,
    );
    await page.locator("#add-cart").click();
    assert.equal(
      await page.evaluate(
        (k) => JSON.parse(localStorage.getItem(`igdemo_${k}_cart_v1`)).length,
        kind,
      ),
      1,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-category="pattern"]').click();
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(250);
    await page.screenshot({
      path: `reports/revision-4/pages/${kind}-mobile.jpg`,
      quality: 90,
      fullPage: true,
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    assert.equal(overflow, false, kind + " overflow");
    results.push({
      kind,
      state,
      errors,
      missing,
      overflow,
      metrics: await page.evaluate(() => window.studioReview.metrics()),
    });
    await page.locator('[data-pattern=""]').click();
    await wait(page);
    assert.equal(
      (await page.evaluate(() => window.studioReview.getState())).pattern,
      null,
    );
    if (kind !== "flowers") {
      await page.locator('[data-category="base"]').click();
      await page.locator("[data-asset]").first().click();
      await wait(page);
      assert.equal(
        (await page.evaluate(() => window.studioReview.getState())).pattern,
        null,
      );
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(missing, []);
    console.log(kind, "UI passed");
    await page.close();
  }
} finally {
  await close();
  await writeFile(
    "reports/revision-4/ui.json",
    JSON.stringify(results, null, 2),
  );
}

// Browser pipes can stay open after the owned Chrome process exits on Windows.
process.exit(0);
