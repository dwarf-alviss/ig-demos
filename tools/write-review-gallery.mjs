import { readFile, writeFile } from "node:fs/promises";
import { catalogue } from "../shared/catalogue.js";
const coverage = JSON.parse(
  await readFile("reports/revision-2/source-coverage.json", "utf8"),
);
await writeFile(
  "reports/revision-2/gallery.html",
  `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Визуальная проверка портфолио</title><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#f5f4ec;color:#2d342a;font:14px/1.6 system-ui}header{max-width:1300px;margin:auto}h1{font:42px Georgia;margin:0 0 15px}nav{display:flex;gap:12px;flex-wrap:wrap;margin:25px 0}button,a{font:inherit;color:inherit}button{padding:10px 18px;border:1px solid #bdc4b4;background:none;cursor:pointer}button[aria-pressed=true]{background:#38442f;color:white}main{max-width:1300px;margin:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}figure{margin:0;background:white;border:1px solid #dedfd3}img{display:block;width:100%;aspect-ratio:1.6;object-fit:cover}figcaption{padding:12px;font-size:12px}small{display:block;color:#7f8873;font-size:10px;margin-top:4px}.notes{font-size:12px;color:#747f6b;max-width:850px}</style></head><body><header><p>Портфолио / повторная визуальная проверка</p><h1>188 деталей. Четыре характера.</h1><p>${coverage.files} исходных GLB · все непустые группы покрыты · 12 бриллиантовых огранок + 88 цветных камней</p><p class="notes">Снимки настоящих сборок из браузера. Варианты материалов исходных файлов имеют одинаковую геометрию. Пустые файлы спиральной свечи исключены; геометрия из папки красной смородины подписана как свеча. Цены — демонстрационные. <a href="source-coverage.json">Полный отчёт покрытия</a> · <a href="browser-checks.json">Проверки интерфейса</a></p><nav aria-label="Проекты">${[
    ["all", "Все детали"],
    ["cakes", "Торты"],
    ["flowers", "Букеты"],
    ["jewelry", "Украшения"],
  ]
    .map(
      ([id, label]) =>
        `<button data-kind="${id}" aria-pressed="${id === "all"}">${label}</button>`,
    )
    .join(
      "",
    )}<a href="../../">Открыть портфолио ↗</a></nav><nav class="camera"><button data-pose="front" aria-pressed="true">Спереди</button><button data-pose="side" aria-pressed="false">Сбоку</button><button data-pose="top" aria-pressed="false">Сверху</button></nav></header><main>${catalogue.map((a) => `<figure data-project="${a.project}" data-id="${a.id}"><a href="assembled/${a.id}.jpg"><img src="assembled/${a.id}.jpg" alt="Сборка с деталью ${a.name}" loading="lazy"></a><figcaption>${a.name}${a.variant ? " · " + a.variant : ""}<small>${a.id}</small></figcaption></figure>`).join("")}</main><script>document.querySelector('nav').onclick=e=>{const b=e.target.closest('button');if(!b)return;document.querySelectorAll('[data-kind]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.querySelectorAll('figure').forEach(f=>f.hidden=b.dataset.kind!=='all'&&f.dataset.project!==b.dataset.kind);};document.querySelector('.camera').onclick=e=>{const b=e.target.closest('[data-pose]');if(!b)return;document.querySelectorAll('[data-pose]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.querySelectorAll('figure').forEach(f=>{const src='assembled/'+f.dataset.id+(b.dataset.pose==='front'?'':'-'+b.dataset.pose)+'.jpg';f.querySelector('img').src=src;f.querySelector('a').href=src;});};</script></body></html>`,
);
