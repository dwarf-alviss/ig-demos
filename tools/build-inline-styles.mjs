import { reviewBrowser } from "./review-runtime.mjs";
import { readFile, writeFile } from "node:fs/promises";
const { browser, close } = await reviewBrowser();
try {
  const p = await browser.newPage();
  let output = "";
  for (const [file, scope] of [
    ["shared/studio.css", ".inline-studio[data-studio]"],
    ["shared/wardrobe.css", ".inline-studio[data-wardrobe]"],
  ]) {
    const css = await readFile(file, "utf8");
    output += await p.evaluate(
      ({ css, scope }) => {
        const style = document.createElement("style");
        style.textContent = css;
        document.head.append(style);
        const convert = (rules) =>
          [...rules]
            .map((rule) => {
              if (rule.type === 1) {
                const selectors = rule.selectorText
                  .split(",")
                  .map((s) => {
                    s = s.trim();
                    if (s === ":root" || s === "body") return scope;
                    if (s.startsWith("body")) return s.replace(/^body/, scope);
                    return scope + " " + s.replace(/^main\b/, ".inline-main");
                  })
                  .join(",");
                return selectors + "{" + rule.style.cssText + "}";
              }
              if (rule.type === 4)
                return (
                  "@media " +
                  rule.conditionText +
                  "{" +
                  convert(rule.cssRules) +
                  "}"
                );
              return rule.cssText;
            })
            .join("\n");
        const result = convert(style.sheet.cssRules);
        style.remove();
        return result;
      },
      { css, scope },
    );
    output += "\n";
  }
  await writeFile(
    "shared/inline-studio.css",
    output +
      '\n.inline-studio .inline-main{padding:24px;max-width:none}.inline-studio{margin:0;min-width:0}.inline-studio .atelier{top:20px}.inline-studio[data-wardrobe]{background:var(--bg);color:var(--ink)}.inline-studio[data-wardrobe] #add-capsule{background:var(--accent);color:#182019;border-color:var(--accent)}.inline-studio[data-wardrobe] .panel button{color:inherit;border-color:var(--line)}.inline-studio[data-wardrobe] .panel button[aria-pressed="true"]{background:var(--accent);color:#182019}\n@media(max-width:600px){.inline-studio .inline-main{padding:12px}}\n',
  );
} finally {
  await close();
}
