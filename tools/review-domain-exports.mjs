import { reviewBrowser } from "./review-runtime.mjs";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
const out = "reports/revision-4/exports";
await mkdir(out, { recursive: true });
const { browser, close } = await reviewBrowser(),
  results = [];
try {
  for (const kind of ["cakes", "flowers", "jewelry"]) {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
      acceptDownloads: true,
    });
    await page.goto(`http://127.0.0.1:8765/${kind}/studio.html`);
    await page.waitForFunction(() => window.studioReview?.ready());
    await page.evaluate(() => window.studioReview.freeze());
    const state = await page.evaluate(() => window.studioReview.getState());
    for (const [button, extension] of [
      ["#download", "json"],
      ["#snapshot", "png"],
    ]) {
      const pending = page.waitForEvent("download");
      await page.locator(button).click();
      const download = await pending,
        path = `${out}/${kind}-design.${extension}`;
      assert.equal(download.suggestedFilename(), `${kind}-design.${extension}`);
      await download.saveAs(path);
      const bytes = await readFile(path);
      if (extension === "json") {
        const data = JSON.parse(bytes);
        assert.equal(data.project, kind);
        assert.deepEqual(data.configuration, state);
        assert.ok(data.estimateBYN > 0);
      } else {
        const metadata = await sharp(bytes).metadata();
        assert.equal(metadata.format, "png");
        assert.ok(metadata.width > 300 && metadata.height > 300);
        const stats = await sharp(bytes).stats();
        assert.ok(
          stats.channels.slice(0, 3).some((c) => c.stdev > 5),
          "blank exported scene",
        );
      }
      results.push({ kind, extension, bytes: bytes.length, passed: true });
    }
    await page.close();
    console.log(kind, "exports passed");
  }
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  await close();
}
process.exit(0);
