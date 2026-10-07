import { chromium } from "@playwright/test";
import { cakeBlockers } from "../shared/assembly-profiles.js";
import { catalogue, byId } from "../shared/catalogue.js";
import { defaults, normalize } from "../shared/studio-state.js";
import {
  compatibleStones,
  compatibleSettings,
} from "../shared/jewelry-rules.js";
import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
const requested = process.argv[2] || "all",
  filter = process.argv[3];
const first = Number(process.env.REVIEW_START || 0),
  last = Number(process.env.REVIEW_END || Infinity),
  resume = process.env.REVIEW_RESUME === "1",
  sharded = Number.isFinite(last);
const reuse = process.env.REVIEW_REUSE === "1";
const folder = "reports/revision-3";
await mkdir(`${folder}/combinations`, { recursive: true });
const cases = [],
  seenCases = new Set();
const assets = (kind, category) =>
  catalogue.filter((a) => a.project === kind && a.category === category);
const add = (kind, state, label) => {
  const s = normalize(kind, state),
    key = JSON.stringify(s);
  if (seenCases.has(kind + key)) return;
  seenCases.add(kind + key);
  cases.push({ kind, state: s, label, key });
};
if (["all", "flowers"].includes(requested)) {
  for (const pack of assets("flowers", "pack"))
    for (const flower of assets("flowers", "flowers"))
      for (const green of [null, ...assets("flowers", "green")])
        for (const ribbon of [null, ...assets("flowers", "ribbon")]) {
          add(
            "flowers",
            {
              ...defaults("flowers"),
              pack: pack.id,
              flowers: [flower.id],
              counts: { [flower.id]: 7 },
              green: green ? [green.id] : [],
              ribbon: ribbon?.id || null,
            },
            [
              pack.id,
              flower.id,
              green?.id || "no-green",
              ribbon?.id || "no-ribbon",
            ].join(" / "),
          );
        }
  for (const pack of assets("flowers", "pack"))
    for (let offset = 0; offset < 10; offset++) {
      const flowers = assets("flowers", "flowers")
          .filter((_, i) => (i + offset) % 10 < 5)
          .map((a) => a.id),
        green = assets("flowers", "green")
          .filter((_, i) => i % 2 === offset % 2)
          .map((a) => a.id);
      add(
        "flowers",
        {
          ...defaults("flowers"),
          pack: pack.id,
          flowers,
          green,
          counts: Object.fromEntries(flowers.map((id) => [id, 15])),
          ribbon: assets("flowers", "ribbon")[offset % 3].id,
        },
        `${pack.id} / mixed maximum ${offset}`,
      );
    }
}
if (["all", "flowers"].includes(requested))
  for (const pack of assets("flowers", "pack"))
    for (const flower of assets("flowers", "flowers"))
      add(
        "flowers",
        {
          ...defaults("flowers"),
          pack: pack.id,
          flowers: [flower.id],
          counts: { [flower.id]: 7 },
          green: [],
          ribbon: null,
          palette: 4,
        },
        `${pack.id} / ${flower.id} / native colors`,
      );
if (["all", "cakes"].includes(requested)) {
  const decor = assets("cakes", "decor"),
    toppers = [null, ...assets("cakes", "topper")];
  for (const base of assets("cakes", "base"))
    for (const amount of [1, 2, 3]) {
      const s = {
        ...defaults("cakes"),
        base: base.id,
        decor: [],
        topper: null,
        tiers: amount,
        pieces: [1, 4, 6][amount - 1],
      };
      for (const d of decor)
        for (const topper of toppers) {
          if (
            ["glaze", "border"].includes(d.role) &&
            base.id.includes("pastry")
          )
            continue;
          if (d.role === "glaze" && base.id.includes("hex")) continue;
          add(
            "cakes",
            {
              ...s,
              decor: [d.id],
              counts: { [d.id]: d.role === "sprinkle" ? 24 : 4 },
              topper: topper?.id || null,
            },
            `${base.id} / ${amount} / ${d.id} / ${topper?.id || "no-topper"}`,
          );
        }
      // Each decoration pair at high quantity tests mixed dimensions and capacity.
      for (let i = 0; i < decor.length; i++)
        for (let j = i + 1; j < decor.length; j++) {
          const pair = [decor[i], decor[j]];
          if (
            pair.some((d) => ["glaze", "border"].includes(d.role)) &&
            base.id.includes("pastry")
          )
            continue;
          if (pair.some((d) => d.role === "glaze") && base.id.includes("hex"))
            continue;
          add(
            "cakes",
            {
              ...s,
              decor: pair.map((d) => d.id),
              counts: Object.fromEntries(pair.map((d) => [d.id, 14])),
            },
            `${base.id} / ${amount} / pair ${pair.map((d) => d.id).join("+")}`,
          );
        }
    }
  for (const filling of ["vanilla", "berry", "chocolate", "pistachio"])
    for (const layout of ["crescent", "wreath", "center"])
      add(
        "cakes",
        { ...defaults("cakes"), filling, layout, tiers: 3 },
        `three tiers / ${filling} / ${layout}`,
      );
}
if (["all", "jewelry"].includes(requested)) {
  for (const base of assets("jewelry", "base")) {
    const s = {
      ...defaults("jewelry"),
      base: base.id,
      setting: null,
      finding: [],
    };
    for (const setting of [null, ...compatibleSettings(s)]) {
      const design = { ...s, setting: setting?.id || null };
      for (const stone of [null, ...compatibleStones(design)]) {
        add(
          "jewelry",
          { ...design, stone: stone?.id || null },
          `${base.id} / ${setting?.id || "native-socket"} / ${stone?.id || "no-stone"}`,
        );
      }
    }
  }
}
await writeFile(
  `${folder}/matrix-${requested}.json`,
  JSON.stringify(
    cases.map(({ key, ...c }) => c),
    null,
    2,
  ),
);
console.log(requested, cases.length, "configurations");
let previous = [];
const output = `${folder}/results-${requested}${sharded ? `-${first}-${last}` : ""}.json`;
if (filter || resume || reuse)
  try {
    previous = JSON.parse(
      await readFile(`${folder}/results-${requested}.json`, "utf8"),
    );
  } catch {}
const browser = await chromium.launch({ channel: "chrome", headless: true });
const cached = new Map(previous.map((r) => [r.key, r])),
  cacheFolder = `.git/review-cache/${requested}`;
if (reuse) {
  await mkdir(cacheFolder, { recursive: true });
  for (const r of previous)
    if (!r.error)
      for (const pose of r.kind === "flowers"
        ? ["front", "back"]
        : r.kind === "jewelry"
          ? ["front", "top"]
          : ["front"])
        await copyFile(
          `${folder}/combinations/${r.id}-${pose}.jpg`,
          `${cacheFolder}/${r.id}-${pose}.jpg`,
        );
}
const records = reuse
  ? []
  : sharded
    ? previous.filter((r) => {
        const i = Number(r.id.split("-").at(-1));
        return i >= first && i < last && cases[i]?.key === r.key;
      })
    : previous;
let currentKind, page;
for (let i = 0; i < cases.length; i++) {
  const c = cases[i];
  if (i < first || i >= last) continue;
  const existingId = `${requested}-${String(i).padStart(5, "0")}`;
  const unchanged = cached.get(c.key);
  if (
    reuse &&
    unchanged &&
    !unchanged.error &&
    (c.kind !== "cakes" ||
      unchanged.metrics.assembly.decorSeats.length -
        cakeBlockers(c.state).length ===
        c.state.decor
          .filter((id) => !["border", "glaze"].includes(byId[id].role))
          .reduce((n, id) => n + c.state.counts[id], 0)) &&
    (process.env.REVIEW_REUSE_STABLE === "1" ||
      !c.state.decor?.some((id) =>
        ["bk-decor-wafer-roll", "bk-decor-chocolate-shard"].includes(id),
      ))
  ) {
    for (const pose of c.kind === "flowers"
      ? ["front", "back"]
      : c.kind === "jewelry"
        ? ["front", "top"]
        : ["front"])
      await copyFile(
        `${cacheFolder}/${unchanged.id}-${pose}.jpg`,
        `${folder}/combinations/${existingId}-${pose}.jpg`,
      );
    records.push({
      ...unchanged,
      ...c,
      id: existingId,
      reusedFrom: unchanged.id,
    });
    continue;
  }
  if (
    resume &&
    records.some((r) => r.id === existingId && !r.error && r.key === c.key)
  )
    continue;
  if (
    filter &&
    !c.label.includes(filter) &&
    !JSON.stringify(c.state).includes(filter)
  )
    continue;
  const id = `${requested}-${String(i).padStart(5, "0")}`;
  if (c.kind !== currentKind) {
    if (page) await page.close();
    page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    await page.goto(`http://127.0.0.1:8765/${c.kind}/studio.html`);
    await page.waitForFunction(() => window.studioReview?.ready(), {
      timeout: 60000,
    });
    await page.evaluate(() => window.studioReview.freeze());
    currentKind = c.kind;
  }
  const prior = records.findIndex((r) => r.id === id);
  if (prior >= 0) records.splice(prior, 1);
  try {
    await page.evaluate((s) => window.studioReview.setState(s), c.state);
    await page.waitForFunction(() => window.studioReview.ready(), {
      timeout: 60000,
    });
    const poses =
      c.kind === "flowers"
        ? ["front", "back"]
        : c.kind === "jewelry"
          ? ["front", "top"]
          : ["front"];
    for (const pose of poses) {
      await page.evaluate((p) => window.studioReview.pose(p), pose);
      await page.locator("#viewer").screenshot({
        path: `${folder}/combinations/${id}-${pose}.jpg`,
        type: "jpeg",
        quality: 72,
      });
    }
    records.push({
      id,
      ...c,
      metrics: await page.evaluate(() => window.studioReview.metrics()),
    });
  } catch (error) {
    records.push({ id, ...c, error: error.message });
    console.log("FAILED", id, c.label);
  }
  if (i % 25 === 0) {
    await writeFile(
      output,
      JSON.stringify(
        records.sort((a, b) => a.id.localeCompare(b.id)),
        null,
        2,
      ),
    );
    console.log(requested, i + 1, "/", cases.length);
  }
}
await writeFile(
  output,
  JSON.stringify(
    records.sort((a, b) => a.id.localeCompare(b.id)),
    null,
    2,
  ),
);
await browser.close();
