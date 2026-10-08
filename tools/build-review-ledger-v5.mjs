import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { catalogue } from "../shared/catalogue.js";
import { recipes, ingredients } from "../shared/domain.js";

const folder = "reports/revision-5";
const bundleHash = createHash("sha256")
  .update(await readFile("shared/studio.bundle.js"))
  .digest("hex");
const read = async (path) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    return null;
  }
};
const reviews = (await read(`${folder}/visual-review.json`)) || [];
const cases = [];
for (const suite of ["native", "domain"]) {
  const matrix = await read(
    `${folder}/matrix-${suite === "native" ? "all" : "domain"}.json`,
  );
  const current = new Map();
  try {
    for (const line of (
      await readFile(
        `${folder}/combinations/${bundleHash.slice(0, 12)}/${suite}/progress.jsonl`,
        "utf8",
      )
    )
      .trim()
      .split("\n")) {
      const row = JSON.parse(line);
      current.set(row.key, row);
    }
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  // These families retained their assembly geometry throughout subsequent
  // flower/native-setting edits. Keep the original evidence hash visible.
  const preserved = new Map();
  const familyEvidence =
    suite === "native"
      ? [
          ["jewelry", "7974ba54cf17"],
          ["flowers", "e806ecd60de7"],
          ["flowers", "4479e92b4043"],
          ["flowers", "d17d1d3abc1b"],
          ["flowers", "4c711d204873"],
          ["flowers", "59322e891289"],
          ["flowers", "f74a91e3e956"],
          ["cakes", "cff6a33edfd2"],
          ["cakes", "d17d1d3abc1b"],
          ["cakes", "84dba3cc87d8"],
          ["cakes", "4c711d204873"],
          ["cakes", "e9e0d316006f"],
        ]
      : [
          ["jewelry", "1244faab04d6"],
          ["flowers", "7c3d18633381"],
          ["flowers", "8e955c4ed83a"],
          ["flowers", "59322e891289"],
          ["flowers", "f74a91e3e956"],
          ["cakes", "61daa640c94e"],
          ["cakes", "84dba3cc87d8"],
          ["cakes", "e9e0d316006f"],
        ];
  // Native cakes include precise food contact and their current lighting.
  // Domain cakes changed their cutout support and require the current proof.
  for (const [kind, hash] of familyEvidence) {
    const proof = await read(
      `${folder}/combinations/${hash}/${suite}/results-${kind}.json`,
    );
    if (proof?.completed && proof.failures === 0)
      for (const row of proof.results) {
        preserved.set(row.key, row);
      }
    {
      try {
        const lines = await readFile(
          `${folder}/combinations/${hash}/${suite}/progress.jsonl`,
          "utf8",
        );
        for (const line of lines.trim().split("\n")) {
          const row = JSON.parse(line);
          if (
            row.kind === kind &&
            !row.error &&
            Object.keys(row.poses || {}).length === 4
          )
            preserved.set(row.key, row);
        }
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
  }
  // Basket support and crown corrections invalidate all native baskets.
  if (suite === "native")
    for (const [key, row] of preserved) {
      const state = JSON.parse(key);
      if (
        row.kind === "flowers" &&
        state.pack === "fl-wrap-basket-rattan" &&
        !row.bundleHash.startsWith("f74a91e3e956")
      )
        preserved.delete(key);
    }
  if (suite === "domain")
    for (const [key, row] of preserved) {
      const state = JSON.parse(key);
      if (
        row.kind === "flowers" &&
        state.pattern === "summer-basket" &&
        !row.bundleHash.startsWith("f74a91e3e956")
      )
        preserved.delete(key);
    }
  for (const [key, row] of preserved) {
    if (row.kind !== "cakes") continue;
    const state = JSON.parse(key);
    const changedCrumble =
      suite === "native"
        ? state.decor?.includes("bk-decor-crumble-cluster")
        : state.foodDecor?.some(
            (id) => ingredients[id]?.asset === "bk-decor-crumble-cluster",
          );
    if (changedCrumble && !row.bundleHash.startsWith("e9e0d316006f")) {
      preserved.delete(key);
      continue;
    }
    const small = [
      "macaron",
      "eclair",
      "profiterole",
      "paris-brest",
      "cupcake",
      "donut",
      "cookie",
      "brownie",
    ];
    const affected =
      suite === "native"
        ? state.base?.includes("-pastry-") &&
          state.decor?.includes("bk-berry-raspberry")
        : small.includes(recipes[state.pattern]?.type) &&
          state.foodDecor?.some(
            (id) => ingredients[id]?.asset === "bk-berry-raspberry",
          );
    if (
      affected &&
      !["84dba3cc87d8", "4c711d204873", "e9e0d316006f"].some((hash) =>
        row.bundleHash.startsWith(hash),
      )
    )
      preserved.delete(key);
  }
  for (const c of matrix) {
    const key = JSON.stringify(c.state),
      id = `${c.kind}-${createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
    const row = current.get(key) || preserved.get(key);
    const status = row?.error
      ? "failed"
      : row
        ? current.has(key)
          ? "captured-current"
          : "captured-preserved-family"
        : "pending";
    const observed = reviews
      .filter((r) => r.bundleHash === row?.bundleHash && r.id === id)
      .flatMap((r) => r.poses);
    cases.push({
      suite,
      kind: c.kind,
      id,
      label: c.label,
      status,
      bundleHash: row?.bundleHash || null,
      error: row?.error || null,
      reviewedPoses: [...new Set(observed)],
      images:
        row && !row.error
          ? Object.fromEntries(
              ["front", "side", "top", "back"].map((p) => [
                p,
                `combinations/${row.bundleHash.slice(0, 12)}/${suite}/${id}-${p}.jpg`,
              ]),
            )
          : null,
    });
  }
}
const assembled = (await read(`${folder}/assembled-review.json`)) || [];
const modelReviews =
  (await read(`${folder}/visual-model-review.json`))?.models || [];
const models = catalogue.map((a) => ({
  id: a.id,
  kind: a.project,
  name: a.name,
  assembled: assembled.find((r) => r.id === a.id)?.bundleHash || null,
  reviewedPoses:
    modelReviews.find(
      (r) =>
        r.id === a.id &&
        r.bundleHash === assembled.find((v) => v.id === a.id)?.bundleHash,
    )?.poses || [],
}));
const counts = Object.fromEntries(
  ["native", "domain"].map((s) => [
    s,
    Object.fromEntries(
      ["flowers", "cakes", "jewelry"].map((k) => {
        const rows = cases.filter((c) => c.suite === s && c.kind === k);
        return [
          k,
          {
            expected: rows.length,
            current: rows.filter((c) => c.status === "captured-current").length,
            preserved: rows.filter(
              (c) => c.status === "captured-preserved-family",
            ).length,
            failed: rows.filter((c) => c.status === "failed").length,
            reviewed: rows.filter((c) => c.reviewedPoses.length).length,
          },
        ];
      }),
    ),
  ]),
);
await writeFile(
  `${folder}/coverage.json`,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      bundleHash,
      counts,
      models,
      cases,
    },
    null,
    2,
  ),
);
await writeFile(
  `${folder}/index.html`,
  `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Проверка конструкторов</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f1eb;color:#262923;font:15px/1.5 system-ui}main{max-width:1480px;margin:auto;padding:32px}h1{font-size:32px;margin:0}p{max-width:950px}header{border-bottom:1px solid #cbcbbf;padding-bottom:24px}.controls{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}input,select,button{font:inherit;padding:10px;border:1px solid #bbb;border-radius:5px;background:white}input{flex:1;min-width:200px}.layout{display:grid;grid-template-columns:360px 1fr;gap:24px}.list{max-height:900px;overflow:auto}.case{display:block;width:100%;text-align:left;margin-bottom:8px}.case small{display:block;color:#666}.poses{display:grid;grid-template-columns:1fr 1fr;gap:12px}.poses img{width:100%;display:block}.pose{background:white;padding:10px}table{border-collapse:collapse;margin:20px 0}td,th{padding:8px 14px;border:1px solid #ccc;text-align:left}code{overflow-wrap:anywhere}.muted{color:#666}a{color:#356148}@media(max-width:800px){main{padding:16px}.layout{grid-template-columns:1fr}.list{max-height:300px}.poses{grid-template-columns:1fr}}
</style><main><header><h1>Проверка физических сборок</h1><p>Отдельные модели, разрешённые пары и крайние количества. Снятый кадр и успешный автоматический тест сами по себе не означают визуальную приёмку. «Просмотрен» отмечается отдельно для конкретного ракурса.</p><p class="muted" id="version"></p><nav><a href="native/index.html">Исходные модели</a> · <a href="assembled/index.html">Модели в сборке</a> · <a href="patterns/contacts/page-0.jpg">Цветочные композиции</a> · <a href="task.md">Критерии задачи</a></nav></header><div id="summary"></div><div class="controls"><select id="suite"><option value="">Все сборки</option><option value="native">Исходные модели</option><option value="domain">Проектные композиции</option></select><select id="kind"><option value="">Все проекты</option><option value="flowers">Цветы</option><option value="cakes">Кондитерка</option><option value="jewelry">Ювелирка</option></select><select id="status"><option value="">Все статусы</option><option value="pending">Ожидают проверки</option><option value="captured-current">Сняты в текущей версии</option><option value="captured-preserved-family">Сняты для сохранённой геометрии</option><option value="failed">Ошибка проверки</option></select><input id="search" placeholder="Название модели, упаковки или композиции"></div><p id="match"></p><div class="layout"><div id="list" class="list"></div><section id="detail"><p>Выберите сочетание для просмотра четырёх ракурсов.</p></section></div><p class="muted">Список показывает первые 100 совпадений. Для остальных уточните название модели. Отчёт обновляется запуском build-review-ledger-v5.mjs; во время длительного прогона это снимок состояния, а не окончательный результат.</p></main><script type="module">
const data=await fetch('coverage.json').then(r=>r.json());const $=id=>document.getElementById(id);const names={flowers:'Цветы',cakes:'Кондитерка',jewelry:'Ювелирка'};const labels={'pending':'Ожидает проверки','captured-current':'Снято в текущей версии','captured-preserved-family':'Сохранённая геометрия; исходный хеш','failed':'Ошибка'};
$('version').textContent='Сборка '+data.bundleHash.slice(0,12)+' · отчёт '+new Date(data.generatedAt).toLocaleString('ru');
const table=document.createElement('table');table.innerHTML='<tr><th>Сборки</th><th>Проект</th><th>Состояний</th><th>Текущие кадры</th><th>Сохранённая геометрия</th><th>Ошибки</th></tr>';for(const [s,ks]of Object.entries(data.counts))for(const[k,c]of Object.entries(ks)){const tr=document.createElement('tr');for(const v of [s,names[k],c.expected,c.current,c.preserved,c.failed]){const td=document.createElement('td');td.textContent=v;tr.append(td)}table.append(tr)}$('summary').append(table);
function show(c){$('detail').replaceChildren();const title=document.createElement('h2');title.textContent=c.label;$('detail').append(title);const p=document.createElement('p');p.textContent=labels[c.status]+(c.bundleHash?' · '+c.bundleHash.slice(0,12):'');$('detail').append(p);if(c.error){const e=document.createElement('p');e.textContent=c.error;$('detail').append(e)}if(!c.images)return;const grid=document.createElement('div');grid.className='poses';for(const[pose,path]of Object.entries(c.images)){const block=document.createElement('div');block.className='pose';const text=document.createElement('p');text.textContent=pose+' · '+(c.reviewedPoses.includes(pose)?'просмотрен':'визуальная проверка не отмечена');const a=document.createElement('a');a.href=path;a.target='_blank';const image=document.createElement('img');image.src=path;image.loading='lazy';a.append(image);block.append(text,a);grid.append(block)}$('detail').append(grid)}
function update(){const query=$('search').value.toLowerCase();const rows=data.cases.filter(c=>(!$('suite').value||c.suite===$('suite').value)&&(!$('kind').value||c.kind===$('kind').value)&&(!$('status').value||c.status===$('status').value)&&c.label.toLowerCase().includes(query));$('match').textContent='Найдено '+rows.length+' состояний';$('list').replaceChildren();for(const c of rows.slice(0,100)){const button=document.createElement('button');button.className='case';const label=document.createElement('span');label.textContent=c.label;const small=document.createElement('small');small.textContent=c.suite+' · '+labels[c.status];button.append(label,small);button.onclick=()=>show(c);$('list').append(button)}}for(const id of ['suite','kind','status','search'])$(id).addEventListener('input',update);update();
</script></html>`,
);
console.log(JSON.stringify(counts));
