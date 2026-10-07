import { reviewBrowser } from "./review-runtime.mjs";
import { mkdir, readdir } from "node:fs/promises";
import sharp from "sharp";
import { baking, flowers } from "../shared/domain.js";
await mkdir("shared/domain-thumbnails", { recursive: true });
for (const file of await readdir("reports/revision-4/patterns"))
  if (file.endsWith("-front.jpg"))
    await sharp("reports/revision-4/patterns/" + file)
      .resize(320, 220, { fit: "cover" })
      .jpeg({ quality: 86 })
      .toFile("shared/domain-thumbnails/" + file.replace("-front", ""));
const { browser, close } = await reviewBrowser();
try {
  for (const [kind, components] of [
    [
      "cakes",
      baking.components.filter(
        (c) => c.role === "decor" && !c.asset && c.available,
      ),
    ],
    [
      "flowers",
      flowers.plants.filter((p) => !p.asset && p.compatibleBouquets.length),
    ],
  ]) {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    await page.goto("http://127.0.0.1:8765/" + kind + "/studio.html");
    await page.waitForFunction(() => window.studioReview?.ready());
    await page.evaluate(() => window.studioReview.freeze());
    for (const c of components) {
      await page.evaluate(
        ({ kind, id }) =>
          window.studioReview.component(
            kind === "cakes" ? "food" : "plant",
            id,
          ),
        { kind, id: c.id },
      );
      await sharp(await page.locator("#viewer").screenshot())
        .resize(320, 220, { fit: "contain", background: "#eee9e1" })
        .jpeg({ quality: 86 })
        .toFile(
          "shared/domain-thumbnails/" +
            (kind === "cakes" ? "component-" : "plant-") +
            c.id +
            ".jpg",
        );
      console.log(c.id);
    }
    await page.close();
  }
} finally {
  await close();
}

// Browser pipes can stay open after the owned Chrome process exits on Windows.
process.exit(0);
