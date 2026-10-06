import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  results = [];
for (const kind of ["cakes", "flowers", "jewelry"]) {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:8765/${kind}/studio.html`);
  await page.waitForSelector('[data-ready="true"]');
  const buttons = await page.locator("#options [data-key]").count();
  for (let i = 0; i < buttons; i++) {
    await page.locator("#options [data-key]").nth(i).click();
    await page.waitForFunction(
      () =>
        document.querySelector("#viewer").getAttribute("aria-busy") === "false",
    );
    assert.ok(
      (await page.locator("#status").textContent()).includes("готова"),
      kind + " " + i,
    );
  }
  await page.locator("#reset").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#viewer").getAttribute("aria-busy") === "false",
  );
  const first = await page.locator("#price").textContent();
  await page.locator('[data-key="color"][data-value="2"]').click();
  await page.locator("#undo").click();
  assert.equal(await page.locator("#price").textContent(), first);
  await page.locator('[data-key="base"][data-value="1"]').click();
  await page.locator("#save").click();
  await page.reload();
  await page.waitForSelector('[data-ready="true"]');
  assert.equal(
    await page
      .locator('[data-key="base"][data-value="1"]')
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.locator("#add-cart").click();
  await page.waitForFunction(
    () => document.querySelector("#cart-link").hidden === false,
  );
  await page.locator("#cart-link").click();
  await page.waitForSelector(".cart-line");
  assert.ok((await page.locator("body").textContent()).includes("из студии"));
  await page.waitForTimeout(500);
  await page.goBack();
  await page.waitForTimeout(500);
  await page.waitForSelector('[data-ready="true"]');
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#download").click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), `${kind}-design.json`);
  await page.locator("#reset").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#viewer").getAttribute("aria-busy") === "false",
  );
  await page.screenshot({
    path: `reports/screenshots/${kind}.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `reports/screenshots/${kind}-mobile.png`,
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  results.push({
    kind,
    options: buttons,
    desktop: true,
    mobile: true,
    storage: true,
    download: true,
    errors,
  });
  await page.close();
}
const fallback = await browser.newPage();
await fallback.addInitScript(() => {
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    if (type.startsWith("webgl")) return null;
    return get.call(this, type, ...args);
  };
});
await fallback.goto("http://127.0.0.1:8765/cakes/studio.html");
await fallback.waitForFunction(() =>
  document.querySelector("#status").textContent.includes("недоступно"),
);
assert.equal(await fallback.locator("#fallback").isVisible(), true);
await fallback.locator('[data-key="quantity"][data-value="3"]').click();
assert.ok((await fallback.locator("#price").textContent()).includes("267"));
await fallback.close();
for (const route of [
  "",
  "fashion/studio.html",
  "cakes/",
  "flowers/",
  "jewelry/",
  "fashion/",
]) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto("http://127.0.0.1:8765/" + route);
  await p.screenshot({
    path: `reports/screenshots/${route ? route.replaceAll("/", "-").replace(".html", "") : "portfolio"}.png`,
    fullPage: true,
  });
  await p.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    route,
  );
  if (route.includes("studio")) {
    await p.locator('[data-size="L"]').click();
    await p.locator("#save").click();
    await p.reload();
    assert.equal(
      await p.locator('[data-size="L"]').getAttribute("aria-pressed"),
      "true",
    );
    await p.screenshot({
      path: "reports/screenshots/fashion-mobile.png",
      fullPage: true,
    });
  }
  await p.close();
}
await browser.close();
await writeFile(
  "reports/browser-checks.json",
  JSON.stringify(
    { studios: results, webglFallback: true, allProjectMobileWidths: true },
    null,
    2,
  ),
);
console.log(
  "PASS: all options, storage, undo, downloads, mobile layouts, fallback and four project pages",
);
