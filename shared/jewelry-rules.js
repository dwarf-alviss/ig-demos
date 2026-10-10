import { catalogue, byId } from "./catalogue.js";
import { designs } from "./domain.js";
export function stoneShape(id) {
  const a = byId[id];
  if (!a) return null;
  if (id === "jw-stone-round-brilliant") return "round";
  if (id === "jw-stone-cabochon-oval") return "oval-cabochon";
  if (a.pack === "diamond")
    return [
      "baguette",
      "cushion",
      "heart",
      "asscher",
      "step",
      "emerald",
      "princess",
      "round",
      "oval",
      "marquise",
      "pear",
      "trillion",
    ][a.index - 1];
  if (a.pack === "gem")
    return [
      "oval-cabochon",
      "round-cabochon",
      "round",
      "emerald",
      "asscher",
      "heart",
      "marquise",
      "oval",
      "pear",
      "trillion",
      "cushion",
    ][Math.floor((a.index - 1) / 8)];
  return null;
}
const fixedShape = {
  "jw-set-baguette": "baguette",
  "jw-set-heart": "heart",
  "jw-set-marquise": "marquise",
  "jw-set-pear": "pear",
};
const plainBases = new Set([
  "jw-base-cuff-bracelet",
  "jw-base-ear-cuff",
  "jw-base-signet",
]);
export function compatibleFindings(s) {
  if (designs[s.pattern]) return [];
  const allowed =
    s.base === "jw-base-pendant"
      ? ["jw-part-bail-hinged", "jw-part-jump-ring"]
      : s.base === "jw-base-drop-earring"
        ? ["jw-part-ear-wire-french", "jw-part-jump-ring"]
        : s.base === "jw-base-chain-link-cable"
          ? ["jw-part-clasp-lobster", "jw-part-charm-tag", "jw-part-jump-ring"]
          : [];
  const connectedKit = (s.finding || []).some(
    (id) => allowed.includes(id) && id !== "jw-part-jump-ring",
  );
  return catalogue.filter(
    (a) =>
      allowed.includes(a.id) && !(connectedKit && a.id === "jw-part-jump-ring"),
  );
}
export function compatibleStones(s) {
  if (designs[s.pattern]) {
    const cuts = designs[s.pattern].compatibleCuts;
    return catalogue.filter(
      (a) =>
        a.category === "stone" &&
        cuts.some((c) =>
          c === "cabochon"
            ? stoneShape(a.id)?.includes("cabochon")
            : c === stoneShape(a.id),
        ),
    );
  }
  if (plainBases.has(s.base)) return [];
  let shapes;
  if (["jw-base-pendant", "jw-base-cocktail"].includes(s.base))
    shapes = ["oval"];
  else if (s.base === "jw-set-pave-band") shapes = ["round"];
  else if (fixedShape[s.setting]) shapes = [fixedShape[s.setting]];
  else if (
    [
      "jw-base-solitaire",
      "jw-base-cocktail",
      "jw-set-halo",
      "jw-base-stud-earring",
      "jw-base-drop-earring",
      "jw-base-pendant",
    ].includes(s.base)
  )
    shapes = ["round"];
  else if (s.base === "jw-set-bezel") shapes = ["round-cabochon", "round"];
  else if (s.setting === "jw-set-prong6") shapes = ["round", "oval"];
  else if (s.setting === "jw-set-prong4")
    shapes = ["round", "cushion", "princess"];
  else
    shapes = [
      "round",
      "cushion",
      "princess",
      "oval",
      "heart",
      "baguette",
      "asscher",
      "step",
      "emerald",
      "marquise",
      "pear",
      "trillion",
      "oval-cabochon",
      "round-cabochon",
    ];
  return catalogue.filter(
    (a) => a.category === "stone" && shapes.includes(stoneShape(a.id)),
  );
}
export function compatibleSettings(s) {
  if (designs[s.pattern]) return [];
  return [
    "jw-base-band-plain",
    "jw-base-stacking-thin",
    "jw-base-chain-link-cable",
  ].includes(s.base)
    ? catalogue.filter((a) => a.category === "setting")
    : [];
}
export function requiredSetting(stone) {
  const shape = stoneShape(stone);
  if (shape?.includes("cabochon")) return "custom-bezel";
  if (shape === "trillion") return "custom-trillion";
  if (["cushion", "princess", "asscher", "emerald", "step"].includes(shape))
    return "custom-corner";
  return (
    Object.entries(fixedShape).find(([, v]) => v === shape)?.[0] ||
    (shape === "oval" || shape === "oval-cabochon"
      ? "jw-set-prong6"
      : "jw-set-prong4")
  );
}
export function normalizeJewelry(s) {
  const findings = compatibleFindings(s);
  s.finding = (s.finding || []).filter((id) =>
    findings.some((a) => a.id === id),
  );
  for (const id of Object.keys(s.counts || {}))
    if (byId[id]?.category === "finding" && !s.finding.includes(id))
      delete s.counts[id];
  for (const id of s.finding) s.counts[id] = 1;
  if (!compatibleSettings(s).some((a) => a.id === s.setting)) s.setting = null;
  const choices = compatibleStones(s);
  if (!choices.length) s.stone = null;
  else if (
    (s.pattern && !s.stone) ||
    (s.stone && !choices.some((a) => a.id === s.stone))
  ) {
    const color = byId[s.stone]?.color;
    s.stone =
      (color && choices.find((a) => a.color === color)?.id) ||
      choices.find((a) =>
        designs[s.pattern]?.defaultCut === "cabochon"
          ? stoneShape(a.id)?.includes("cabochon")
          : stoneShape(a.id) === designs[s.pattern]?.defaultCut,
      )?.id ||
      choices.find((a) => a.id === "jw-stone-diamond-08")?.id ||
      choices[0].id;
  }
  return s;
}
