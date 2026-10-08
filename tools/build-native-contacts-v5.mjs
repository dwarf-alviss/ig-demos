import sharp from "sharp";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const directory = "reports/revision-5/native";
const results = JSON.parse(
  await readFile("reports/revision-5/native/results.json", "utf8"),
).results.map((r) => ({
  ...r,
  project: r.id.startsWith("bk-")
    ? "cakes"
    : r.id.startsWith("fl-")
      ? "flowers"
      : "jewelry",
}));
await mkdir(`${directory}/contacts`, { recursive: true });
const sheets = [];
for (const project of ["cakes", "flowers", "jewelry"]) {
  const rows = results.filter((r) => r.project === project);
  for (const pose of ["front", "side", "top"]) {
    for (let batch = 0; batch < Math.ceil(rows.length / 15); batch++) {
      const records = rows.slice(batch * 15, batch * 15 + 15),
        composite = [];
      for (const [i, r] of records.entries()) {
        const left = (i % 5) * 240,
          top = Math.floor(i / 5) * 270;
        composite.push({
          input: await sharp(`${directory}/${r.id}-${pose}.jpg`)
            .resize(240, 240)
            .toBuffer(),
          left,
          top,
        });
        composite.push({
          input: Buffer.from(
            `<svg width="240" height="30"><rect width="240" height="30" fill="#fff"/><text x="4" y="18" font-family="Arial" font-size="10">${r.id}</text></svg>`,
          ),
          left,
          top: top + 240,
        });
      }
      const file = `contacts/${project}-${pose}-${batch}.jpg`;
      await sharp({
        create: {
          width: 1200,
          height: Math.ceil(records.length / 5) * 270,
          channels: 3,
          background: "#fff",
        },
      })
        .composite(composite)
        .jpeg({ quality: 94 })
        .toFile(`${directory}/${file}`);
      sheets.push(file);
    }
  }
}
await writeFile(
  `${directory}/index.html`,
  `<!doctype html><meta charset="utf-8"><title>Модели в сборке — аудит</title><style>body{font:16px system-ui;background:#ecebe5}img{max-width:100%}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0;background:white;padding:10px}a{color:inherit}</style><h1>Все ${results.length} исходных компонентов</h1><p>Свободные сборки по каждой модели. Окончательная приемка требует просмотра соединений и сочетаний с разных сторон.</p>${sheets.map((p) => `<a href="${p}"><img src="${p}"></a>`).join("")}<div class="grid">${results.map((r) => `<figure><figcaption>${r.id}</figcaption>${["front", "side", "top"].map((p) => `<a href="${r.id}-${p}.jpg"><img src="${r.id}-${p}.jpg"></a>`).join("")}</figure>`).join("")}</div>`,
);
console.log(sheets.length, "sheets", results.length, "models");
