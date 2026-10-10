import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const base = "https://dwarf-alviss.github.io/ig-demos/";
const pages = [
  "directions.html",
  ...["cakes", "flowers", "jewelry", "fashion"].flatMap((k) => [
    `${k}/index.html`,
    `${k}/concept-b.html`,
    `${k}/concept-c.html`,
    `${k}/studio.html`,
  ]),
];
const results = [];
for (const path of pages) {
  const response = await fetch(base + path, {
      signal: AbortSignal.timeout(30000),
    }),
    html = await response.text();
  if (!response.ok) throw Error(`${path}: HTTP ${response.status}`);
  if (path.includes("concept-") && !html.includes("data-concept="))
    throw Error("Old or incorrect content " + path);
  if (path.endsWith("/index.html") && !html.includes("data-load-studio"))
    throw Error("Deployment not updated " + path);
  if (path === "directions.html" && !html.includes("shared/design-previews/"))
    throw Error("Missing concept previews");
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter(
      (p) =>
        !p.startsWith("#") &&
        !p.startsWith("http") &&
        /\.(jpg|css|js)$/.test(p),
    );
  for (const asset of new Set(assets)) {
    const url = new URL(asset, base + path),
      r = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(30000),
      });
    if (!r.ok) throw Error(`Missing asset ${url.pathname}: ${r.status}`);
  }
  results.push({
    path,
    status: response.status,
    assetsChecked: new Set(assets).size,
  });
  console.log(path, "passed");
}
const bytes = Buffer.from(
    await (await fetch(base + "shared/studio.bundle.js")).arrayBuffer(),
  ),
  hash = createHash("sha256").update(bytes).digest("hex"),
  local = createHash("sha256")
    .update(await readFile("shared/studio.bundle.js"))
    .digest("hex");
if (hash !== local)
  throw Error("Published constructor differs from validated local bundle");
await writeFile(
  "reports/showcase-final/public-validation.json",
  JSON.stringify({ base, pages: results, bundleHash: hash }, null, 2) + "\n",
);
console.log("Public bundle matches local");
