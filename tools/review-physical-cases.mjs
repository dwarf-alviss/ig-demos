import { chromium } from "@playwright/test";
import { defaults, normalize } from "../shared/studio-state.js";
import { mkdir, writeFile } from "node:fs/promises";
const cases = [
  [
    "cakes",
    "eclair-wafers",
    {
      base: "bk-pastry-eclair",
      pieces: 6,
      decor: ["bk-decor-wafer-roll", "bk-berry-raspberry"],
      counts: { "bk-decor-wafer-roll": 4, "bk-berry-raspberry": 6 },
      topper: null,
    },
  ],
  [
    "cakes",
    "cookie-wafers",
    {
      base: "bk-pastry-cookie-round",
      pieces: 4,
      decor: ["bk-decor-wafer-roll", "bk-decor-chocolate-shard"],
      counts: { "bk-decor-wafer-roll": 4, "bk-decor-chocolate-shard": 4 },
      topper: null,
    },
  ],
  [
    "cakes",
    "cupcake-cream",
    {
      base: "bk-pastry-cupcake",
      pieces: 4,
      decor: ["bk-berry-blueberry"],
      counts: { "bk-berry-blueberry": 12 },
      topper: null,
    },
  ],
  [
    "cakes",
    "donut-hole",
    {
      base: "bk-pastry-donut",
      pieces: 1,
      decor: ["bk-berry-blueberry", "bk-berry-strawberry"],
      counts: { "bk-berry-blueberry": 8, "bk-berry-strawberry": 3 },
      topper: "bk-topper-heart",
    },
  ],
  [
    "cakes",
    "eclair-six",
    {
      base: "bk-pastry-eclair",
      pieces: 6,
      decor: ["bk-berry-raspberry"],
      counts: { "bk-berry-raspberry": 12 },
      topper: null,
    },
  ],
  [
    "cakes",
    "hex-three",
    {
      base: "bk-struct-tier-hex",
      tiers: 3,
      decor: [
        "bk-decor-shell-border",
        "bk-berry-strawberry",
        "bk-berry-blueberry",
      ],
      counts: {
        "bk-decor-shell-border": 1,
        "bk-berry-strawberry": 9,
        "bk-berry-blueberry": 12,
      },
      topper: "bk-topper-crown",
    },
  ],
  [
    "flowers",
    "basket-lily",
    {
      pack: "fl-wrap-basket-rattan",
      flowers: ["fl-flower-lily-oriental"],
      counts: { "fl-flower-lily-oriental": 7 },
      green: ["fl-green-fern"],
      ribbon: "fl-ribbon-jute-twine",
    },
  ],
  [
    "flowers",
    "hatbox-native",
    {
      pack: "fl-wrap-hatbox-round",
      palette: 4,
      flowers: ["fl-flower-gerbera"],
      counts: { "fl-flower-gerbera": 7 },
      green: ["fl-green-lagurus"],
      ribbon: "fl-ribbon-jute-twine",
    },
  ],
];
await mkdir("reports/revision-3/physical", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  report = [];
for (const [kind, name, patch] of cases) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`http://127.0.0.1:8765/${kind}/studio.html`);
  await p.waitForFunction(() => window.studioReview?.ready(), {
    timeout: 60000,
  });
  await p.evaluate(() => window.studioReview.freeze());
  const state = normalize(kind, { ...defaults(kind), ...patch });
  await p.evaluate((s) => window.studioReview.setState(s), state);
  await p.waitForFunction(() => window.studioReview.ready(), {
    timeout: 60000,
  });
  for (const pose of ["front", kind === "flowers" ? "back" : "top"]) {
    await p.evaluate((pose) => window.studioReview.pose(pose), pose);
    await p.locator("#viewer").screenshot({
      path: `reports/revision-3/physical/${name}-${pose}.jpg`,
      quality: 90,
    });
  }
  report.push({
    kind,
    name,
    state,
    errors,
    metrics: await p.evaluate(() => window.studioReview.metrics()),
  });
  console.log(name);
  await p.close();
}
await browser.close();
await writeFile(
  "reports/revision-3/physical/results.json",
  JSON.stringify(report, null, 2),
);
