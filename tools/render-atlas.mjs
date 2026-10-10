import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const originals = JSON.parse(
  await readFile("shared/models/manifest.json", "utf8"),
).filter(
  (x) =>
    !x.id.includes("jw-stone-diamond_gem_shape_set") &&
    !x.id.includes("jw-stone-gemstone_pack"),
);
const stones = JSON.parse(
  await readFile("shared/models/stones/catalog.json", "utf8"),
);
const all = [...originals, ...stones];
await mkdir("shared/thumbnails", { recursive: true });
await mkdir("reports/visual-audit", { recursive: true });
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({ viewport: { width: 360, height: 360 } });
await p.goto("http://127.0.0.1:8765/tools/model-audit.html");
await p.waitForFunction(() => window.auditReady);
const profiles = [];
for (const [i, record] of all.entries()) {
  const profile = await p.evaluate((r) => window.audit(r), record);
  await p
    .locator("canvas")
    .screenshot({
      path: `shared/thumbnails/${record.id}.jpg`,
      type: "jpeg",
      quality: 85,
    });
  profiles.push({ id: record.id, url: record.url, ...profile });
  if (i % 20 === 0) console.log("Audited", i + 1, "/", all.length);
}
await writeFile(
  "reports/visual-audit/profiles.json",
  JSON.stringify(profiles, null, 2),
);
const cats = {
  cakes: all.filter((x) => x.id.startsWith("bk-")),
  flowers: all.filter((x) => x.id.startsWith("fl-")),
  jewelry: all.filter((x) => x.id.startsWith("jw-") && !x.pack),
  diamond: stones.filter((x) => x.pack === "diamond"),
  gem: stones.filter((x) => x.pack === "gem" && (x.index - 1) % 8 === 0),
};
for (const [category, records] of Object.entries(cats)) {
  const page = await b.newPage({ viewport: { width: 1500, height: 1100 } });
  await page.setContent(
    `<body style="margin:0;padding:12px;background:#f8f7f2;font:13px system-ui"><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px">${records.map((r) => `<figure style="margin:0"><img width="236" height="236" src="http://127.0.0.1:8765/shared/thumbnails/${r.id}.jpg"><figcaption>${r.id}</figcaption></figure>`).join("")}</div></body>`,
  );
  await page
    .locator("img")
    .evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode())));
  await page.screenshot({
    path: `reports/visual-audit/${category}-atlas.jpg`,
    fullPage: true,
    type: "jpeg",
    quality: 90,
  });
  await page.close();
}
await b.close();
console.log("Visual atlas ready", all.length);
