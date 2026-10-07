import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { patternLists } from "../shared/domain.js";
const out = "reports/revision-4/stress";
const hash = createHash("sha256")
  .update(await readFile("shared/studio.bundle.js"))
  .digest("hex");
const rows = new Map();
for (const line of (await readFile(`${out}/progress.jsonl`, "utf8"))
  .trim()
  .split("\n")) {
  const row = JSON.parse(line);
  if (row.buildHash === hash && row.result.visual)
    rows.set(`${row.result.kind}:${row.result.id}`, row.result);
}
await mkdir(`${out}/contacts`, { recursive: true });
const groups = [];
for (const kind of ["cakes", "flowers", "jewelry"]) {
  const records = [...rows.values()].filter((r) => r.kind === kind);
  if (kind === "flowers") {
    for (const pattern of patternLists[kind])
      groups.push({
        id: `${kind}-${pattern.id}`,
        title: pattern.name,
        records: records.filter((r) => r.state.pattern === pattern.id),
      });
  } else {
    for (let i = 0; i < records.length; i += 100)
      groups.push({
        id: `${kind}-${i / 100 + 1}`,
        title: `${kind} · ${i + 1}–${Math.min(i + 100, records.length)}`,
        records: records.slice(i, i + 100),
      });
  }
}
let sections = "";
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
for (const group of groups.filter((g) => g.records.length)) {
  const composite = [],
    columns = 8,
    width = 200,
    height = 160;
  for (const [i, r] of group.records.entries()) {
    const path = `${r.kind}-${r.id}.jpg`;
    composite.push({
      input: await sharp(`${out}/${path}`)
        .resize(width, height - 25, { fit: "cover" })
        .toBuffer(),
      left: (i % columns) * width,
      top: Math.floor(i / columns) * height,
    });
    const label =
      r.kind === "flowers"
        ? `${r.state.pack?.replace("fl-", "") || "bridal"} · ${r.state.ribbon?.replace("fl-ribbon-", "") || "plain"} · ${r.state.palette}`
        : r.id;
    composite.push({
      input: Buffer.from(
        `<svg width="200" height="25"><text x="4" y="17" font-size="9" font-family="Arial">${esc(label)}</text></svg>`,
      ),
      left: (i % columns) * width,
      top: Math.floor(i / columns) * height + height - 25,
    });
  }
  await sharp({
    create: {
      width: columns * width,
      height: Math.ceil(group.records.length / columns) * height,
      channels: 3,
      background: "#eee9e1",
    },
  })
    .composite(composite)
    .jpeg({ quality: 90 })
    .toFile(`${out}/contacts/${group.id}.jpg`);
  sections += `<section><h2>${esc(group.title)} · ${group.records.length}</h2><a href="contacts/${group.id}.jpg"><img src="contacts/${group.id}.jpg" loading="lazy" alt="${esc(group.title)}"></a><details><summary>Индивидуальные изображения</summary>${group.records.map((r) => `<a href="${r.kind}-${r.id}.jpg">${esc(r.id)}</a>`).join("<br>")}</details></section>`;
}
await writeFile(
  `${out}/index.html`,
  `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Матрица визуальной проверки</title><style>body{background:#f4f0e8;color:#282c26;font:16px/1.5 system-ui;margin:24px}img{max-width:100%}a{color:#566944}section{margin:40px 0}</style><a href="../index.html">← Основная галерея</a><h1>Матрица визуальной проверки</h1><p>${rows.size} сцен актуальной сборки. Каждая сохранена отдельно; снимки проверены на непустое изображение. Геометрические проверки и состояние — в results.json. Автоматические проверки не заменяют оценку правдоподобия.</p>${sections}</html>`,
);
console.log(rows.size, "visual records grouped");
