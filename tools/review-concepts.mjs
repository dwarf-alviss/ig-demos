import { conceptPath } from "./selected-concepts.mjs";
import { reviewBrowser } from "./review-runtime.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.REVIEW_URL || "http://127.0.0.1:8765",
  folder = process.env.REVIEW_OUTPUT || "reports/concepts-structural";
await mkdir(folder, { recursive: true });
const { browser, close } = await reviewBrowser(),
  results = [];
try {
  for (const kind of ["cakes", "flowers", "jewelry", "fashion"])
    for (const v of ["a", "b", "c"]) {
      const page = await browser.newPage({
          viewport: { width: 1440, height: 1050 },
        }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const path = `${kind}/${conceptPath(kind, v)}`;
      await page.goto(base + "/" + path, { waitUntil: "networkidle" });
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(
        await page.locator("body").getAttribute("data-architecture"),
        `${kind}-${v}`,
      );
      assert.equal(
        await page.locator(".concept-bar [aria-current]").count(),
        1,
      );
      await page.screenshot({
        path: `${folder}/${kind}-${v}-desktop.jpg`,
        fullPage: true,
        quality: 82,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        kind + " " + v + " overflow",
      );
      await page.screenshot({
        path: `${folder}/${kind}-${v}-mobile.jpg`,
        fullPage: true,
        quality: 78,
      });
      await page.setViewportSize({ width: 1440, height: 1050 });
      const choices = page.locator("[data-choice]");
      let expected = await page
        .locator(".studio-section")
        .getAttribute("data-initial-pattern");
      if ((await choices.count()) > 1) {
        await choices.nth(1).click();
        assert.equal(await choices.nth(1).getAttribute("aria-pressed"), "true");
        expected = await choices.nth(1).getAttribute("data-pattern");
      }
      if (await page.locator("[data-letter]").count()) {
        await page.locator("[data-letter]").fill("Для тебя.");
        assert.equal(
          await page.locator("[data-letter-preview]").textContent(),
          "Для тебя.",
        );
      }
      if (await page.locator("[data-draft]").count()) {
        await page
          .locator("[data-draft] input[name=occasion]")
          .fill("Личная история");
        await page.locator("[data-draft] button[type=submit]").click();
        assert.ok(
          (await page.locator("[data-draft] output").textContent()).includes(
            "сохранена",
          ),
        );
      }
      if (await page.locator("[data-rhythm]").count()) {
        await page.locator("[data-rhythm]").nth(1).click();
        assert.ok(
          (await page.locator("[data-rhythm-output]").textContent()).includes(
            "Раз в две недели",
          ),
        );
      }
      if (await page.locator("[data-outfit]").count()) {
        await page.locator("[data-outfit]").nth(1).click();
        assert.ok(
          (await page.locator("[data-outfit-output]").textContent()).includes(
            "Свободный день",
          ),
        );
      }
      if (await page.locator("[data-product-search]").count()) {
        await page.locator("[data-product-search]").fill("неттакоготовара");
        assert.ok(await page.locator("[data-empty]").isVisible());
        await page.locator("[data-product-search]").fill("");
        assert.ok(
          Number(await page.locator("[data-result-count]").textContent()) > 0,
        );
      }
      await page.locator("[data-load-studio]").click();
      await page
        .frameLocator(".studio-mount iframe")
        .locator("h1")
        .waitFor({ timeout: 60000 });
      const frame = page.frames().find((f) => f.url().endsWith("/studio.html"));
      if (kind === "fashion")
        await frame.waitForFunction(
          () =>
            document.querySelectorAll("#look img").length === 3 &&
            [...document.querySelectorAll("#look img")].every(
              (i) => i.complete && i.naturalWidth > 0,
            ),
          null,
          { timeout: 60000 },
        );
      else
        await frame.waitForFunction(
          (pattern) =>
            window.studioReview?.ready() &&
            window.studioReview.getState().pattern === pattern,
          expected,
          { timeout: 90000 },
        );
      assert.deepEqual(errors, []);
      await page.locator(".studio-mount").screenshot({
        path: `${folder}/${kind}-${v}-embedded.jpg`,
        quality: 80,
      });
      results.push({
        kind,
        variant: v,
        path,
        architecture: `${kind}-${v}`,
        desktop: true,
        mobile: true,
        interaction: true,
        embedded: true,
        selectedPattern: expected,
      });
      console.log(kind, v, "passed");
      await page.close();
    }
  await writeFile(
    folder + "/validation.json",
    JSON.stringify({ base, results, concepts: results.length }, null, 2) + "\n",
  );
} finally {
  await close();
}
