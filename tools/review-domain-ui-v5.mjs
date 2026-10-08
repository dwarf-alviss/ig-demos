const reviewUrl = process.env.REVIEW_URL || "http://127.0.0.1:8765";
import { createHash } from "node:crypto";
import { reviewBrowser } from "./review-runtime.mjs";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const bundleBytes = await readFile(
  process.env.REVIEW_BUNDLE || "shared/studio.bundle.js",
);
const bundleHash = createHash("sha256").update(bundleBytes).digest("hex");
const cssHash = createHash("sha256")
  .update(await readFile("shared/studio.css"))
  .digest("hex");
await mkdir("reports/revision-5/pages", { recursive: true });
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
      missing = [],
      networkFailures = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.log(kind, "PAGE ERROR", e.message);
    });
    page.on("requestfailed", (r) => {
      const reason = r.failure()?.errorText;
      console.log(kind, "REQUEST FAILED", r.url(), reason);
      if (reason !== "net::ERR_ABORTED")
        networkFailures.push([r.url(), reason]);
    });
    page.on("response", (r) => {
      if (r.status() >= 400 && r.url().includes("127.0.0.1"))
        missing.push([r.status(), r.url()]);
    });
    await page.route("**/shared/studio.bundle.js", (route) =>
      route.fulfill({
        body: bundleBytes,
        contentType: "application/javascript",
      }),
    );
    await page.goto(`${reviewUrl}/${kind}/studio.html`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
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
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
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
    const undecoded = await page.evaluate(async () => {
      const images = [...document.images];
      images.forEach((image) => {
        image.loading = "eager";
      });
      return (
        await Promise.all(
          images.map(async (image) => {
            try {
              await image.decode();
              return null;
            } catch {
              return image.src;
            }
          }),
        )
      ).filter(Boolean);
    });
    assert.deepEqual(
      undecoded,
      [],
      "catalogue previews must load before visual review",
    );
    await page.screenshot({
      path: `reports/revision-5/pages/${kind}-desktop.jpg`,
      quality: 90,
      fullPage: true,
    });
    const state = await page.evaluate(() => window.studioReview.getState());
    await page.locator("#add-cart").click();
    await page.waitForFunction(
      () => !document.querySelector("#cart-link").hidden,
    );
    await page.goto(`${reviewUrl}/${kind}/cart.html`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
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
    assert.deepEqual(
      await page.evaluate(() =>
        [...document.querySelectorAll(".category-tabs button")]
          .filter((n) => n.scrollWidth > n.clientWidth + 1)
          .map((n) => n.textContent.trim()),
      ),
      [],
      "Mobile category labels must fit their own buttons",
    );
    assert.deepEqual(
      await page.evaluate(() =>
        [...document.querySelectorAll(".counter button")]
          .filter((n) => n.getBoundingClientRect().height < 44)
          .map((n) => n.textContent.trim()),
      ),
      [],
      "Mobile quantity buttons need a44px touch target",
    );
    await page.locator('[data-category="pattern"]').click();
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(250);
    await page.screenshot({
      path: `reports/revision-5/pages/${kind}-mobile.jpg`,
      quality: 90,
      fullPage: true,
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    assert.equal(overflow, false, kind + " overflow");
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
    if (kind === "cakes") {
      const current = await page.evaluate(() => window.studioReview.getState());
      await page.evaluate(
        (s) =>
          window.studioReview.setState({
            ...s,
            base: "bk-pastry-brownie-bite",
            pieces: 1,
            tiers: 1,
            decor: [],
            counts: {},
            topper: null,
          }),
        current,
      );
      await wait(page);
      await page.locator('[data-category="decor"]').click();
      assert.equal(
        await page.locator('[data-asset="bk-berry-strawberry"]').isDisabled(),
        true,
      );
      assert.equal(
        await page.locator('[data-asset="bk-berry-blueberry"]').isDisabled(),
        false,
      );
      await page.locator('[data-config="pieces"]').selectOption("4");
      await wait(page);
      assert.equal(
        await page.locator('[data-asset="bk-berry-strawberry"]').isDisabled(),
        false,
      );
      await page.locator('[data-asset="bk-berry-strawberry"]').click();
      await wait(page);
      assert.ok(
        (
          await page.evaluate(() => window.studioReview.getState())
        ).decor.includes("bk-berry-strawberry"),
      );
      await page.screenshot({
        path: "reports/revision-5/pages/cakes-native-capacity.jpg",
        fullPage: true,
      });
    }
    if (kind === "jewelry") {
      const current = await page.evaluate(() => window.studioReview.getState());
      await page.evaluate(
        (s) =>
          window.studioReview.setState({
            ...s,
            pattern: null,
            base: "jw-base-drop-earring",
            stone: null,
            setting: null,
            finding: [],
            counts: {},
          }),
        current,
      );
      await wait(page);
      await page.locator('[data-category="finding"]').click();
      await page.locator('[data-asset="jw-part-jump-ring"]').click();
      await wait(page);
      await page.locator('[data-asset="jw-part-ear-wire-french"]').click();
      await wait(page);
      const native = await page.evaluate(() => window.studioReview.getState());
      assert.deepEqual(native.finding, ["jw-part-ear-wire-french"]);
      assert.equal(native.counts["jw-part-jump-ring"], undefined);
      assert.equal(
        await page.locator('[data-asset="jw-part-jump-ring"]').count(),
        0,
      );
      assert.ok(
        (await page.locator("#catalog").innerText()).includes(
          "не оплачивается отдельно",
        ),
      );
      await page.screenshot({
        path: "reports/revision-5/pages/jewelry-native-findings.jpg",
        fullPage: true,
      });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(missing, []);
    assert.deepEqual(
      networkFailures,
      [],
      "required resources must load without network failure",
    );
    results.push({
      bundleHash,
      cssHash,
      passed: true,
      nativeFindingsChecked: kind === "jewelry",
      kind,
      state,
      errors,
      missing,
      networkFailures,
      overflow,
      metrics: await page.evaluate(() => window.studioReview.metrics()),
    });
    console.log(kind, "UI passed");
    await page.close();
  }
} finally {
  await close();
  await writeFile(
    "reports/revision-5/ui.json",
    JSON.stringify(results, null, 2),
  );
}

// Browser pipes can stay open after the owned Chrome process exits on Windows.
process.exit(0);
