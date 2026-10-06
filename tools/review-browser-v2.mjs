import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("reports/revision-2/pages", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const records = [],
  errors = [];
const base = "http://127.0.0.1:8765";
const wait = (p) => p.waitForFunction(() => window.studioReview?.ready());
for (const kind of ["cakes", "flowers", "jewelry"]) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  p.on("pageerror", (e) => errors.push(kind + ": " + e.message));
  await p.goto(`${base}/${kind}/studio.html`);
  await wait(p);
  const original = await p.evaluate(() => window.studioReview.getState());
  await p.locator('[data-palette="2"]').click();
  await wait(p);
  await p.locator("#undo").click();
  await wait(p);
  assert.deepEqual(
    await p.evaluate(() => window.studioReview.getState()),
    original,
  );
  await p.locator("#redo").click();
  await wait(p);
  assert.equal(
    await p.evaluate(() => window.studioReview.getState().palette),
    2,
  );
  await p.reload();
  await wait(p);
  assert.equal(
    await p.evaluate(() => window.studioReview.getState().palette),
    2,
  );
  for (const tab of await p.locator("[data-category]").all()) {
    await tab.click();
    assert.ok((await p.locator("[data-asset]").count()) > 0);
  }
  await p.locator("#search").fill("zzzz");
  assert.equal(await p.locator("[data-asset]").count(), 0);
  await p.locator("#search").fill("");
  const dl = p.waitForEvent("download");
  await p.locator("#download").click();
  assert.equal((await dl).suggestedFilename(), kind + "-design.json");
  await p.locator("#add-cart").click();
  await p.waitForFunction(() => !document.querySelector("#cart-link").hidden);
  await p.goto(`${base}/${kind}/cart.html`);
  assert.ok((await p.locator("body").textContent()).includes("из студии"));
  await p.locator(".edit-design").first().click();
  await wait(p);
  await p.locator('[data-palette="1"]').click();
  await wait(p);
  await p.locator("#add-cart").click();
  await p.waitForFunction(() => !document.querySelector("#cart-link").hidden);
  assert.equal(
    await p.evaluate(
      (k) => JSON.parse(localStorage.getItem(`igdemo_${k}_cart_v1`)).length,
      kind,
    ),
    1,
  );
  await p.locator("#add-cart").click();
  assert.equal(
    await p.evaluate(
      (k) => JSON.parse(localStorage.getItem(`igdemo_${k}_cart_v1`))[0].qty,
      kind,
    ),
    1,
  );
  await p.goto(`${base}/${kind}/studio.html`);
  await wait(p);
  await p.locator("#reset").click();
  await wait(p);
  if (kind === "cakes") {
    await p.evaluate(() => {
      window.contextTest = document
        .querySelector("#canvas")
        .getContext("webgl2")
        .getExtension("WEBGL_lose_context");
      window.contextTest.loseContext();
    });
    await p.waitForFunction(() => document.querySelector("#canvas").hidden);
    await p.evaluate(() => window.contextTest.restoreContext());
    await wait(p);
    assert.equal(await p.locator("#add-cart").isDisabled(), false);
  }
  const baseline = (await p.evaluate(() => window.studioReview.metrics()))
    .geometries;
  for (let i = 0; i < 8; i++) {
    await p.locator(`[data-palette="${i % 4}"]`).click();
    await wait(p);
  }
  assert.equal(
    (await p.evaluate(() => window.studioReview.metrics())).geometries,
    baseline,
  );
  await p.locator("#reset").click();
  await wait(p);
  for (let i = 0; i < 3; i++) {
    await p.evaluate((i) => window.studioReview.preset(i), i);
    await wait(p);
    for (const pose of ["front", "side", "top"]) {
      await p.evaluate((pose) => window.studioReview.pose(pose), pose);
      const m = await p.evaluate(() => window.studioReview.metrics());
      assert.ok(m.box.every((n) => Number.isFinite(n) && n > 0));
    }
    await p.evaluate(() => window.studioReview.pose("front"));
    await p.screenshot({
      path: `reports/revision-2/pages/${kind}-preset-${i}.jpg`,
      fullPage: true,
      type: "jpeg",
      quality: 85,
    });
  }
  await p.setViewportSize({ width: 390, height: 844 });
  await p.screenshot({
    path: `reports/revision-2/pages/${kind}-mobile.jpg`,
    fullPage: true,
    type: "jpeg",
    quality: 85,
  });
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await p.locator("#catalog").scrollIntoViewIfNeeded();
  await p.waitForFunction(() =>
    document.querySelector("#viewer").classList.contains("is-floating"),
  );
  await p.locator(".expand-preview").click();
  await p.waitForFunction(
    () => !document.querySelector("#viewer").classList.contains("is-floating"),
  );
  records.push({
    kind,
    metrics: await p.evaluate(() => window.studioReview.metrics()),
    checks:
      "tabs/search/undo/redo/persistence/download/cart/9 camera poses/mobile",
  });
  await p.close();
}
for (const kind of ["cakes", "flowers", "jewelry", "fashion"]) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  p.on("pageerror", (e) => errors.push(kind + ": " + e.message));
  await p.goto(`${base}/${kind}/`);
  await p
    .locator("img")
    .evaluateAll((imgs) => Promise.all(imgs.map((i) => i.decode())));
  await p.screenshot({
    path: `reports/revision-2/pages/${kind}-home.jpg`,
    fullPage: true,
    type: "jpeg",
    quality: 90,
  });
  await p.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await p.screenshot({
    path: `reports/revision-2/pages/${kind}-home-mobile.jpg`,
    fullPage: true,
    type: "jpeg",
    quality: 85,
  });
  await p.close();
}
const fashion = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
});
fashion.on("pageerror", (e) => errors.push("fashion: " + e.message));
await fashion.goto(`${base}/fashion/studio.html`);
assert.equal(await fashion.locator("#look figure").count(), 3);
await fashion.locator('[data-size="M"]').click();
await fashion.locator('[data-color="milk"][data-color-group="0"]').click();
assert.equal(await fashion.locator("#add-capsule").isDisabled(), false);
await fashion.locator("#add-capsule").click();
assert.equal(
  await fashion.evaluate(
    () => JSON.parse(localStorage.getItem("igdemo_fashion_cart_v1")).length,
  ),
  3,
);
assert.equal(
  await fashion.evaluate(
    () => JSON.parse(localStorage.getItem("igdemo_fashion_cart_v1"))[0].color,
  ),
  "milk",
);
await fashion.locator("#save").click();
await fashion.reload();
assert.equal(
  await fashion.locator('[data-size="M"]').getAttribute("aria-pressed"),
  "true",
);
await fashion.evaluate(() => window.scrollTo(0, 0));
await fashion.screenshot({
  path: "reports/revision-2/pages/fashion-studio.jpg",
  fullPage: true,
  type: "jpeg",
  quality: 90,
});
await fashion.setViewportSize({ width: 390, height: 844 });
assert.ok(
  await fashion.evaluate(
    () => document.documentElement.scrollWidth <= innerWidth,
  ),
);
await fashion.evaluate(() => window.scrollTo(0, 0));
await fashion.screenshot({
  path: "reports/revision-2/pages/fashion-studio-mobile.jpg",
  fullPage: true,
  type: "jpeg",
  quality: 85,
});
await fashion.goto(`${base}/fashion/cart.html`);
assert.equal(await fashion.locator("#cart-items > li").count(), 3);
const fallbackBrowser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--disable-webgl"],
});
const fallback = await fallbackBrowser.newPage();
await fallback.goto(`${base}/cakes/studio.html`);
assert.ok(
  (await fallback.locator("#status").textContent()).includes("недоступно"),
);
await fallback.locator('[data-palette="1"]').click();
assert.ok((await fallback.locator("#catalog button").count()) > 0);
await fallback.locator("#add-cart").click();
await fallback.waitForFunction(
  () => !document.querySelector("#cart-link").hidden,
);
await fallbackBrowser.close();
assert.deepEqual(errors, []);
await writeFile(
  "reports/revision-2/browser-checks.json",
  JSON.stringify(
    {
      records,
      errors,
      fashion: "real catalogue / sizes / stock / three cart items / mobile",
    },
    null,
    2,
  ),
);
await browser.close();
console.log("Browser checks passed");
