import { readFile, writeFile } from "node:fs/promises";
import { catalogue } from "../shared/catalogue.js";
import { defaults, normalize } from "../shared/studio-state.js";
const file = "reports/revision-5/matrix-all.json",
  cases = JSON.parse(await readFile(file, "utf8")),
  seen = new Set(cases.map((c) => c.kind + JSON.stringify(c.state)));
const assets = (c) =>
    catalogue
      .filter((a) => a.project === "flowers" && a.category === c)
      .map((a) => a.id),
  blooms = assets("flowers"),
  greens = assets("green");
const add = (state, label) => {
  const s = normalize("flowers", state),
    key = "flowers" + JSON.stringify(s);
  if (!seen.has(key)) {
    seen.add(key);
    cases.push({ kind: "flowers", state: s, label });
  }
};
for (const pack of assets("pack")) {
  const s = {
    ...defaults("flowers"),
    pattern: null,
    pack,
    green: [],
    ribbon: null,
  };
  for (const flower of blooms)
    for (const count of [1, 15])
      add(
        { ...s, flowers: [flower], counts: { [flower]: count } },
        `${pack} / ${flower} / extreme ${count}`,
      );
  for (let i = 0; i < blooms.length; i++)
    for (let j = i + 1; j < blooms.length; j++)
      for (const counts of [
        [5, 5],
        [1, 15],
        [15, 1],
      ])
        add(
          {
            ...s,
            flowers: [blooms[i], blooms[j]],
            counts: { [blooms[i]]: counts[0], [blooms[j]]: counts[1] },
          },
          `${pack} / flower pair ${blooms[i]}+${blooms[j]} / ${counts.join("+")}`,
        );
  for (let i = 0; i < greens.length; i++)
    for (let j = i + 1; j < greens.length; j++)
      add(
        { ...s, green: [greens[i], greens[j]] },
        `${pack} / foliage pair ${greens[i]}+${greens[j]}`,
      );
  add(
    {
      ...s,
      flowers: blooms,
      green: greens,
      counts: Object.fromEntries(blooms.map((id) => [id, 4])),
    },
    `${pack} / mixed accepted flowers20 foliage6`,
  );
  for (const offset of [0, 4, 8]) {
    const selected = Array.from(
      { length: 5 },
      (_, i) => blooms[(i + offset) % blooms.length],
    );
    const foliage = Array.from(
      { length: 6 },
      (_, i) => greens[(i + offset) % greens.length],
    );
    add(
      {
        ...s,
        flowers: selected,
        green: foliage,
        counts: Object.fromEntries(selected.map((id) => [id, 7])),
      },
      `${pack} / balanced maximum33 subset${offset}`,
    );
  }
}
for (const c of cases)
  if (
    c.kind === "flowers" &&
    c.label.includes("all species and foliage maximum")
  )
    c.label = c.label.replace(
      "all species and foliage maximum",
      "mixed accepted flowers20 foliage6",
    );
await writeFile(file, JSON.stringify(cases, null, 2));
console.log(
  cases.length,
  Object.fromEntries(
    ["flowers", "cakes", "jewelry"].map((k) => [
      k,
      cases.filter((c) => c.kind === k).length,
    ]),
  ),
);
