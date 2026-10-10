import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { patternLists, sources } from "../shared/domain.js";
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
let sections = "";
for (const [kind, patterns] of Object.entries(patternLists)) {
  const rows = Math.ceil(patterns.length / 4),
    composite = [];
  for (const [i, p] of patterns.entries()) {
    composite.push({
      input: await sharp(
        `reports/revision-4/patterns/${kind}-${p.id}-front.jpg`,
      )
        .resize(300, 165, { fit: "cover" })
        .toBuffer(),
      left: (i % 4) * 300,
      top: Math.floor(i / 4) * 195,
    });
    composite.push({
      input: Buffer.from(
        `<svg width="300" height="30"><text x="8" y="20" font-family="Arial" font-size="12">${esc(p.name)}</text></svg>`,
      ),
      left: (i % 4) * 300,
      top: Math.floor(i / 4) * 195 + 165,
    });
  }
  await sharp({
    create: {
      width: 1200,
      height: rows * 195,
      channels: 3,
      background: "#eee9e1",
    },
  })
    .composite(composite)
    .jpeg({ quality: 90 })
    .toFile(`reports/revision-4/${kind}-contact.jpg`);
  sections += `<section id="${kind}"><h2>${{ cakes: "Кондитерская", flowers: "Флористика", jewelry: "Ювелирная мастерская" }[kind]}</h2><a href="../../${kind}/studio.html">Открыть конструктор →</a><div class="grid">${patterns.map((p) => `<article><a href="patterns/${kind}-${p.id}-front.jpg"><img loading="lazy" src="patterns/${kind}-${p.id}-front.jpg" alt="${esc(p.name)}"></a><h3>${esc(p.name)}</h3><a href="patterns/${kind}-${p.id}-top.jpg">Вид сверху</a><p>${p.sources.map((id) => `<a href="${esc(sources[id].url)}">${esc(sources[id].title || id)}</a>`).join(" · ")}</p></article>`).join("")}</div></section>`;
}
await writeFile(
  "reports/revision-4/index.html",
  `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Конструкции · визуальная проверка</title><style>body{margin:0;background:#f4f0e8;color:#282c26;font:16px/1.5 system-ui}main{max-width:1400px;margin:auto;padding:32px}h1{font:42px Georgia}h2{font:32px Georgia}a{color:#566944}nav{display:flex;gap:24px;flex-wrap:wrap}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin:24px 0}article{background:white;padding:16px;border-radius:8px}img{width:100%;height:auto}article p{font-size:13px}h3{margin:12px 0 4px}</style><main><h1>Конструкция, материал, силуэт</h1><p>61 параметрическая композиция. Изображения получены из работающих Three.js сцен. Ссылки ведут к первичным источникам рецептур, флористических приёмов и ювелирных конструкций.</p><p>Опубликованные размеры выделены в базе как publishedMeasures. Остальные размеры, число деталей и параметры материалов — калибровка визуализации. Это адаптации референсов, а не точные сканы авторских изделий. Источники фотографий не включены в проект.</p><nav><a href="#cakes">Торты и пирожные</a><a href="#flowers">Букеты</a><a href="#jewelry">Украшения</a><a href="ui.json">Проверки интерфейсов</a><a href="stress/index.html">Матрица сочетаний</a><a href="containers/contact-front.jpg">Упаковки и ленты</a><a href="exports/results.json">Проверка экспорта</a><a href="stress/results.json">Параметрические проверки</a></nav>${sections}</main></html>`,
);
