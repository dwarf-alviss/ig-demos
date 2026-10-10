import { reviewBrowser } from "./review-runtime.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.REVIEW_URL || "http://127.0.0.1:8765",
  folder = process.env.REVIEW_OUTPUT || "reports/native-studios";
await mkdir(folder, { recursive: true });
const { browser, close } = await reviewBrowser();
const results = [];
try {
  for (const width of [1440, 390])
    for (const kind of ["cakes", "flowers", "jewelry", "fashion"]) {
      const p = await browser.newPage({ viewport: { width, height: 1000 } }),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(base + "/" + kind + "/", { waitUntil: "networkidle" });
      assert.equal(await p.locator(".concept-bar,iframe").count(), 0);
      if (kind === "fashion") {
        await p.waitForFunction(
          () =>
            document.querySelectorAll("#look img").length === 3 &&
            [...document.querySelectorAll("#look img")].every(
              (i) => i.complete && i.naturalWidth,
            ),
        );
        await p.locator("#choices button").nth(1).click();
        assert.equal(
          await p
            .locator("#choices button")
            .nth(1)
            .getAttribute("aria-pressed"),
          "true",
        );
        await p.locator('[data-size="L"]').click();
        assert.equal(
          await p.locator('[data-size="L"]').getAttribute("aria-pressed"),
          "true",
        );
        await p.locator("#save").click();
        assert.match(await p.locator("#status").innerText(), /сохранена/);
        await p.locator("#add-capsule").click();
        assert.equal(
          await p.evaluate(
            () =>
              JSON.parse(localStorage.getItem("igdemo_fashion_cart_v1")).length,
          ),
          3,
        );
      } else {
        const initial = await p
          .locator(".studio-section")
          .getAttribute("data-initial-pattern");
        await p.waitForFunction(
          (v) =>
            window.studioReview?.ready() &&
            window.studioReview.getState().pattern === v,
          initial,
          { timeout: 90000 },
        );
        await p.locator('[data-palette="1"]').click();
        assert.equal(
          await p.evaluate(() => window.studioReview.getState().palette),
          1,
        );
        const config =
            kind === "cakes"
              ? "tiers"
              : kind === "flowers"
                ? "bouquetSize"
                : "size",
          value = kind === "cakes" ? "2" : kind === "flowers" ? "11" : "18";
        await p.locator(`[data-config="${config}"]`).selectOption(value);
        await p.waitForFunction(
          ({ key, value }) =>
            window.studioReview.ready() &&
            window.studioReview.getState()[key] === Number(value),
          { key: config, value },
          { timeout: 90000 },
        );
        await p.locator("#save").click();
        assert.ok(
          await p.evaluate(
            (kind) => localStorage.getItem("portfolio-studio-" + kind + "-v2"),
            kind,
          ),
        );
        await p.locator('[data-preset="1"]').click();
        await p.waitForFunction(
          (v) =>
            window.studioReview.ready() &&
            window.studioReview.getState().pattern !== v,
          initial,
          { timeout: 90000 },
        );
        await p.locator("#undo").click();
        await p.waitForFunction(
          (v) =>
            window.studioReview.ready() &&
            window.studioReview.getState().pattern === v,
          initial,
          { timeout: 90000 },
        );
        await p.locator("#add-cart").click();
        await p.waitForFunction(
          (k) =>
            JSON.parse(localStorage.getItem("igdemo_" + k + "_cart_v1") || "[]")
              .length > 0,
          kind,
          { timeout: 30000 },
        );
      }
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await p.locator("#create").evaluate(el => el.scrollIntoView({block:"start", behavior:"instant"}));
      await p.waitForTimeout(300);
      await p.screenshot({ path: `${folder}/${kind}-${width}.jpg` });
      assert.deepEqual(errors, []);
      results.push({
        kind,
        width,
        inline: true,
        noConceptBanner: true,
        choice: true,
        size: true,
        save: true,
        cart: true,
        overflow: false,
      });
      console.log(kind, width, "passed");
      await p.close();
    }
  await writeFile(
    folder + "/validation.json",
    JSON.stringify({ base, results }, null, 2),
  );
} finally {
  await close();
}
