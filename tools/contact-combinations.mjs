import { chromium } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const kind = process.argv[2] || "jewelry";
let records = JSON.parse(
  await readFile(`reports/revision-3/results-${kind}.json`, "utf8"),
);
const coverage = process.argv[3] === "coverage";
if (coverage && kind === "flowers")
  records = records.filter(
    (r) =>
      r.label.includes("no-ribbon") ||
      r.label.includes("mixed maximum") ||
      r.label.includes("native colors"),
  );
await mkdir("reports/revision-3/contacts", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const pose of kind === "flowers"
  ? ["front", "back"]
  : kind === "jewelry"
    ? ["front", "top"]
    : ["front"]) {
  for (let offset = 0; offset < records.length; offset += 24) {
    const rows = records.slice(offset, offset + 24).filter((r) => !r.error);
    const embedded = await Promise.all(
      rows.map(async (r) => ({
        r,
        url:
          "data:image/jpeg;base64," +
          (
            await readFile(
              `reports/revision-3/combinations/${r.id}-${pose}.jpg`,
            )
          ).toString("base64"),
      })),
    );
    const page = await browser.newPage({
      viewport: { width: 1600, height: 900 },
    });
    await page.setContent(
      `<body style="margin:0;background:#ecece4;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font:10px system-ui">${embedded.map(({ r, url }) => `<figure style="margin:0"><img width="390" src="${url}"><figcaption>${r.id} · ${r.label}</figcaption></figure>`).join("")}</body>`,
    );
    await page
      .locator("img")
      .evaluateAll((imgs) => Promise.all(imgs.map((i) => i.decode())));
    await page.screenshot({
      path: `reports/revision-3/contacts/${kind}-${coverage ? "coverage-" : ""}${pose}-${String(offset / 24).padStart(3, "0")}.jpg`,
      fullPage: true,
      type: "jpeg",
      quality: 84,
    });
    await page.close();
  }
}
await browser.close();
console.log("Contact sheets", kind, records.length);
