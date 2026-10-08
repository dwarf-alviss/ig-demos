import { readFile, writeFile } from "node:fs/promises";
import { normalize } from "../shared/studio-state.js";
const report = [];
for (const file of [
  "matrix-all.json",
  "matrix-native-real-pairs.json",
  "matrix-domain.json",
]) {
  const rows = JSON.parse(await readFile(`reports/revision-5/${file}`, "utf8")),
    seen = new Set(),
    updated = [];
  let changed = 0,
    duplicates = 0;
  for (const row of rows) {
    if (row.kind === "cakes") {
      const state = normalize("cakes", row.state);
      if (JSON.stringify(state) !== JSON.stringify(row.state)) changed++;
      row.state = state;
      if (row.label.includes(" / verified pair ")) {
        const pair = row.label
          .split(" / verified pair ")[1]
          .split(" / ")[0]
          .split("+");
        if (
          !pair.every((id) => state.decor.includes(id) && state.counts[id] > 0)
        )
          row.label = row.label.replace(
            " / verified pair ",
            " / capacity-normalized requested pair ",
          );
      }
    }
    const key = row.kind + JSON.stringify(row.state);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    updated.push(row);
  }
  await writeFile(
    `reports/revision-5/${file}`,
    JSON.stringify(updated, null, 2),
  );
  report.push({ file, changed, duplicates, total: updated.length });
}
await writeFile(
  "reports/revision-5/cake-matrix-renormalization.json",
  JSON.stringify(report, null, 2),
);
console.log(report);
