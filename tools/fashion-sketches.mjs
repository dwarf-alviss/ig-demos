import { readFile, writeFile, mkdir } from "node:fs/promises";
const products = JSON.parse(
  await readFile("reports/fashion-data.json", "utf8"),
).products;
await mkdir("fashion/assets/img/looks", { recursive: true });
const colorMap = {
  black: "#363734",
  graphite: "#555954",
  grey: "#9c9e96",
  milk: "#e2dece",
  blue: "#637e8e",
  beige: "#c4b497",
  olive: "#76806a",
};
for (const sourceProduct of products)
  for (const tone of sourceProduct.colors) {
    const p = { ...sourceProduct, colors: [tone] };
    const color = colorMap[p.colors[0]],
      dress = p.cat === "dress",
      jeans = p.cat === "jeans",
      jacket = p.cat === "suit",
      bag = p.cat === "acc",
      shirt = p.cat === "blouse",
      top = p.id.endsWith("-top");
    let shape,
      details = "";
    if (jeans) {
      shape =
        "M116 66 L244 66 250 190 231 416 184 416 179 207 173 207 169 416 120 416 109 190 Z";
      details =
        '<path d="M117 89H244M176 91V164L181 184M128 91Q143 134 163 127M195 127Q219 134 231 91M124 168L134 402M236 168L219 402M123 408H167M184 408H230"/><path d="M169 67V87M136 67V87M219 67V87"/>';
    } else if (bag) {
      shape =
        "M97 175Q91 157 113 155H249Q270 156 265 178L247 375Q245 388 230 389H127Q113 387 112 372Z";
      details =
        '<path d="M140 165V125Q140 84 180 84T220 125V165" stroke-width="9"/><path d="M133 185L144 365H229L240 184M180 200V320"/>';
    } else if (dress) {
      shape = p.id.endsWith("marta")
        ? "M140 63Q180 90 220 63L274 112 254 226 226 218 218 162 217 226 252 421Q181 441 109 421L143 226 142 162 132 220 107 226 86 112Z"
        : "M144 66Q180 90 216 66L239 105 226 210 235 291 248 418Q180 432 112 418L126 291 134 210 121 105Z";
      details =
        '<path d="M145 70Q180 105 215 70M141 217Q180 225 218 217M143 234Q139 328 128 411M216 236Q222 330 231 414"/>';
      if (p.id.endsWith("marta"))
        details +=
          '<path d="M180 85V422M139 220H221M158 67L180 94 203 67M157 221L170 263 184 241"/>';
    } else {
      shape = top
        ? "M141 114L143 69Q180 92 218 69L220 114 244 299Q180 316 116 299Z"
        : "M139 76Q180 101 221 76L260 99 307 268 270 279 239 179 241 312Q179 326 119 312L121 179 91 279 53 268 102 99Z";
      details =
        '<path d="M143 80Q181 109 218 80M122 306Q180 316 239 306M110 103L126 177M249 103L235 177M70 265L96 269M266 269L293 264"/>';
      if (jacket || shirt || p.id.includes("kardigan"))
        details +=
          '<path d="M180 98V313M139 78L162 157 179 110 199 157 221 78M130 239H164M198 239H230"/>';
      if (jacket)
        details += '<path d="M128 268L162 275 179 304M198 268L231 264"/>';
    }
    const knit = p.cat === "knit" && !top;
    const texture = knit
      ? '<path d="M0 0L4 4 0 8M6 0L10 4 6 8" fill="none" stroke="#ffffff" stroke-opacity=".15" stroke-width=".7"/>'
      : '<path d="M0 1H6M1 0V6" stroke="#ffffff" stroke-opacity=".06" stroke-width=".6"/>';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 480" role="img" aria-label="Эскиз силуэта: ${p.name}"><defs><linearGradient id="cloth" x1="0" x2="1" y2=".15"><stop stop-color="${color}"/><stop offset=".25" stop-color="${color}"/><stop offset=".5" stop-color="${color}"/><stop offset=".68" stop-color="${color}"/><stop offset="1" stop-color="#232821" stop-opacity=".6"/></linearGradient><linearGradient id="fold" x2="1"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><pattern id="weave" width="${knit ? 12 : 6}" height="${knit ? 8 : 6}" patternUnits="userSpaceOnUse">${texture}</pattern><clipPath id="cut"><path d="${shape}"/></clipPath><filter id="shadow" x="-40%" y="-10%" width="180%" height="130%"><feDropShadow dx="3" dy="8" stdDeviation="7" flood-color="#273021" flood-opacity=".16"/></filter></defs><rect width="360" height="480" fill="#e8e9e1"/><ellipse cx="180" cy="448" rx="94" ry="8" fill="#dce0d4"/>${p.id === "p-suit-duga" ? `<g filter="url(#shadow)"><path d="M141 196H223L220 410H190L179 270 171 410H137Z" fill="${color}"/><path d="M152 247L148 403M205 248L205 403" fill="none" stroke="#ffffff" stroke-opacity=".1"/></g>` : ""}<g filter="url(#shadow)" ${p.id === "p-suit-duga" ? 'transform="translate(39 0) scale(.78)"' : ""}><path d="${shape}" fill="url(#cloth)" stroke="${color}" stroke-width="1.5"/><g clip-path="url(#cut)"><rect width="360" height="480" fill="url(#weave)"/><path d="M137 101L129 422 163 423 156 101M201 100L200 420 231 420 223 100" fill="url(#fold)"/></g><g fill="none" stroke="#171f17" stroke-opacity=".27" stroke-width="1.3" stroke-linecap="round">${details}</g></g><text x="24" y="31" font-family="Arial,sans-serif" font-size="9" letter-spacing="2" fill="#78816f">ЛИНИЯ / ЭСКИЗ</text><text x="336" y="461" text-anchor="end" font-family="Arial,sans-serif" font-size="9" fill="#78816f">${p.sizes?.join(" · ") || "ONE SIZE"}</text></svg>`;
    await writeFile(`fashion/assets/img/looks/${p.id}-${tone}.svg`, svg);
    if (tone === sourceProduct.colors[0])
      await writeFile(`fashion/assets/img/looks/${p.id}.svg`, svg);
  }
