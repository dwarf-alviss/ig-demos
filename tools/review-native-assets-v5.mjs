import { build } from "esbuild";
import { reviewBrowser } from "./review-runtime.mjs";
import { catalogue } from "../shared/catalogue.js";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
await build({
  entryPoints: ["shared/audit.js"],
  bundle: true,
  format: "esm",
  outfile: "shared/audit.bundle.js",
  minify: true,
});
const directory = "reports/revision-5/native";
await mkdir(directory, { recursive: true });
const { browser, close } = await reviewBrowser(),
  results = [];
try {
  const page = await browser.newPage({ viewport: { width: 740, height: 740 } });
  await page.goto("http://127.0.0.1:8765/tools/model-audit.html");
  await page.waitForFunction(() => window.auditReady);
  await page.evaluate(() => window.auditResize(720));
  for (const [i, asset] of catalogue.entries()) {
    const poses = {};
    for (const pose of ["front", "side", "top"]) {
      poses[pose] = await page.evaluate(
        ({ asset, pose }) => window.audit(asset, pose),
        { asset, pose },
      );
      await page
        .locator("canvas")
        .screenshot({
          path: `${directory}/${asset.id}-${pose}.jpg`,
          quality: 92,
        });
    }
    results.push({
      id: asset.id,
      category: asset.category,
      project: asset.project,
      poses,
    });
    if (i % 20 === 0)
      console.log("Native assets", i + 1, "/", catalogue.length);
  }
} finally {
  await writeFile(
    `${directory}/results.json`,
    JSON.stringify(
      {
        completed: results.length === catalogue.length,
        expected: catalogue.length,
        auditHash: createHash("sha256")
          .update(await readFile("shared/audit.bundle.js"))
          .digest("hex"),
        results,
      },
      null,
      2,
    ),
  );
  await close();
}
process.exit(0);
