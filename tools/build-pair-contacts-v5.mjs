import sharp from "sharp";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const hash = process.argv[2],
  suite = process.argv[3] || "native",
  kind = process.argv[4] || "flowers",
  filter = process.argv[5] || "";
const base = `reports/revision-5/combinations/${hash}/${suite}`;
const proof =
  process.env.REVIEW_PROGRESS === "1"
    ? await (async () => {
        const byKey = new Map();
        const text = await readFile(base + "/progress.jsonl", "utf8");
        for (const line of text.split("\n")) {
          if (!line.trim()) continue;
          let row;
          try {
            row = JSON.parse(line);
          } catch {
            continue;
          }
          if (row.kind === kind) byKey.set(row.key, row);
        }
        const results = [...byKey.values()].filter(
          (row) =>
            !row.error &&
            ["front", "side", "top", "back"].every(
              (p) => row.poses?.[p]?.image,
            ),
        );
        return { bundleHash: results[0]?.bundleHash, results };
      })()
    : JSON.parse(await readFile(base + "/results-" + kind + ".json", "utf8"));
const rows = proof.results
  .filter((r) => !r.error && r.label.includes(filter))
  .slice(0, Number(process.env.REVIEW_LIMIT) || Infinity);
const dir = `reports/revision-5/pair-contacts/${hash}-${suite}-${kind}-${filter.replace(/[^a-z0-9]/gi, "").slice(0, 40) || "all"}`;
await mkdir(dir, { recursive: true });
const sheets = [];
for (let page = 0; page < Math.ceil(rows.length / 6); page++) {
  const batch = rows.slice(page * 6, page * 6 + 6),
    layers = [];
  for (const [row, r] of batch.entries()) {
    for (const [col, pose] of ["front", "side", "top", "back"].entries())
      layers.push({
        input: await sharp(`${base}/${r.id}-${pose}.jpg`)
          .resize(300, 220)
          .toBuffer(),
        left: col * 300,
        top: row * 250,
      });
    const parts = r.label.split(" / ");
    if (r.state?.base?.includes("-pastry-") && /^bk-pastry-/.test(parts[0]))
      parts[1] = r.state.pieces + " изделий";
    const label = parts
      .join(" / ")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;");
    layers.push({
      input: Buffer.from(
        `<svg width="1200" height="30"><rect width="1200" height="30" fill="white"/><text x="8" y="18" font-size="12">${label}</text></svg>`,
      ),
      left: 0,
      top: row * 250 + 220,
    });
  }
  const file = `page-${page}.jpg`;
  await sharp({
    create: {
      width: 1200,
      height: batch.length * 250,
      channels: 3,
      background: "white",
    },
  })
    .composite(layers)
    .jpeg({ quality: 94 })
    .toFile(`${dir}/${file}`);
  sheets.push({
    file,
    ids: batch.map((r) => r.id),
    bundleHash: proof.bundleHash,
    poses: ["front", "side", "top", "back"],
  });
}
await writeFile(`${dir}/sheets.json`, JSON.stringify(sheets, null, 2));
console.log(rows.length, "cases", sheets.length, "sheets", dir);
