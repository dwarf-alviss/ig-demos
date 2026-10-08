import { readFile, writeFile } from "node:fs/promises";
import { catalogue } from "../shared/catalogue.js";
import { defaults, normalize } from "../shared/studio-state.js";
const file = "reports/revision-5/matrix-all.json",
  rows = JSON.parse(await readFile(file, "utf8"));
const previousScope = JSON.parse(
  await readFile(
    "reports/revision-5/matrix-native-real-pairs.json",
    "utf8",
  ).catch(() => "[]"),
);
const scope = new Map(
  previousScope.map((r) => [r.kind + JSON.stringify(r.state), r]),
);
const seen = new Set(rows.map((r) => r.kind + JSON.stringify(r.state))),
  added = [],
  rejected = [];
const decor = catalogue.filter(
  (a) => a.project === "cakes" && a.category === "decor",
);
for (const row of rows) {
  if (
    row.kind !== "cakes" ||
    !row.label.includes(" / pair ") ||
    row.label.includes(" · исключены по вместимости:")
  )
    continue;
  const requested = row.label.split(" / pair ")[1].split("+");
  const missing = requested.filter((id) => !row.state.decor.includes(id));
  if (missing.length)
    row.label += " · исключены по вместимости: " + missing.join(",");
}
for (const base of catalogue.filter(
  (a) => a.project === "cakes" && a.category === "base",
))
  for (const amount of [1, 2, 3])
    for (let i = 0; i < decor.length; i++)
      for (let j = i + 1; j < decor.length; j++) {
        const pair = [decor[i], decor[j]];
        if (
          base.id.includes("pastry") &&
          pair.some((d) => ["glaze", "border"].includes(d.role))
        )
          continue;
        if (base.id.includes("hex") && pair.some((d) => d.role === "glaze"))
          continue;
        const ids = pair.map((d) => d.id),
          s = {
            ...defaults("cakes"),
            pattern: null,
            base: base.id,
            decor: ids,
            topper: null,
            tiers: amount,
            pieces: [1, 4, 6][amount - 1],
          };
        let fits = false;
        for (const quantity of [
          1,
          ...Array.from({ length: 14 }, (_, i) => 14 - i),
        ]) {
          const state = normalize("cakes", {
            ...s,
            counts: Object.fromEntries(ids.map((id) => [id, quantity])),
          });
          if (!ids.every((id) => state.decor.includes(id))) continue;
          fits = true;
          const key = "cakes" + JSON.stringify(state);
          if (!seen.has(key)) {
            seen.add(key);
            const row = {
              kind: "cakes",
              state,
              label: `${base.id} / ${base.id.includes("pastry") ? state.pieces + " изделий" : state.tiers + " яруса"} / verified pair ${ids.join("+")} / requested ${quantity}`,
            };
            rows.push(row);
            added.push(row);
            scope.set(key, row);
          }
          if (quantity !== 1) break;
        }
        if (!fits)
          rejected.push({
            base: base.id,
            tiers: amount,
            pieces: s.pieces,
            requested: ids,
            reason:
              "Both components cannot retain at least one physical seat in this composition.",
          });
      }
await writeFile(file, JSON.stringify(rows, null, 2) + "\n");
await writeFile(
  "reports/revision-5/matrix-native-real-pairs.json",
  JSON.stringify([...scope.values()], null, 2) + "\n",
);
await writeFile(
  "reports/revision-5/rejected-cake-pairs.json",
  JSON.stringify(rejected, null, 2) + "\n",
);
console.log({
  total: rows.length,
  added: added.length,
  rejected: rejected.length,
  cakes: rows.filter((r) => r.kind === "cakes").length,
});
