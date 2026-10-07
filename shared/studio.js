import { catalogue, byId } from "./catalogue.js";
import {
  patternLists,
  resolvePattern,
  ingredients,
  plants,
  initialTaxonCounts,
} from "./domain.js";
import { compatibleStones, compatibleSettings } from "./jewelry-rules.js";
import {
  projectSpecs,
  presetPatterns,
  defaults,
  preset,
  normalize,
  canIncreaseCount,
  selectedIds,
  estimate,
  describe,
  toggleAsset,
} from "./studio-state.js";
import { ModelLibrary } from "./model-library.js";
import { foodDetail } from "./recipe-cake.js";
import { botanicalHead, botanicalBranch } from "./botanical-components.js";
import { assembleProject } from "./assemblers.js";
import { StudioRenderer } from "./studio-renderer.js";
import { disposeTree } from "./scene-utils.js";
import { cartLine, mergeCart, replaceCartDesign, saveShot } from "./cart.js";
const kind = document.body.dataset.studio,
  spec = projectSpecs[kind],
  $ = (s) => document.querySelector(s),
  key = `portfolio-studio-${kind}-v2`;
let saved,
  editingId = null;
try {
  saved = JSON.parse(localStorage.getItem(key));
  const edit = new URLSearchParams(location.search).get("edit"),
    cart = JSON.parse(localStorage.getItem(`igdemo_${kind}_cart_v1`) || "[]");
  const line =
    Array.isArray(cart) &&
    cart.find((x) => x?.id === edit && x.configuration?.version === 2);
  if (line) {
    saved = line.configuration;
    editingId = line.id;
    $("#add-cart").firstChild.textContent = "Сохранить изменения ";
  }
} catch {}
const firstPattern = {
  cakes: "vanilla-celebration",
  flowers: "garden-pink",
  jewelry: "solitaire",
}[kind];
let state = normalize(
    kind,
    saved?.pattern !== undefined
      ? saved
      : { ...(saved || defaults(kind)), pattern: firstPattern },
  ),
  category = spec.categories[0][0],
  query = "",
  stoneFilter = "all",
  history = [],
  future = [],
  ticket = 0,
  renderer,
  assembly,
  loading = false,
  failed = false,
  rotating = false,
  fitNotice = "";
const library = new ModelLibrary(),
  status = $("#status");
const money = (n) => n.toLocaleString("ru-RU") + " BYN",
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
function persist() {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    status.textContent = "Браузер не разрешает сохранение";
  }
}
function change(next, record = true) {
  if (record) {
    history.push(structuredClone(state));
    if (history.length > 40) history.shift();
    future = [];
  }
  state = normalize(kind, next);
  fitNotice =
    kind === "cakes" &&
    next.decor?.some(
      (id) => Number(next.counts?.[id]) > (state.counts[id] || 0),
    )
      ? "Состав скорректирован под выбранную форму и свободное место."
      : "";
  persist();
  renderUI();
  rebuild();
}
function renderCatalog() {
  $("#catalog").setAttribute("aria-labelledby", "tab-" + category);
  const pattern = resolvePattern(kind, state.pattern);
  if (category === "pattern") {
    const entries = patternLists[kind].filter(
      (p) => !query || p.name.toLowerCase().includes(query),
    );
    $("#catalog-count").textContent = entries.length + " конструкций";
    $("#catalog").innerHTML =
      entries
        .map(
          (p) =>
            `<button class="asset-card ${state.pattern === p.id ? "is-selected" : ""}" data-pattern="${p.id}" aria-pressed="${state.pattern === p.id}"><span class="asset-image"><img src="../shared/domain-thumbnails/${kind}-${p.id}.jpg" alt="" loading="lazy" width="120" height="120"><span class="asset-check">✓</span></span><span class="asset-name">${esc(p.name)}</span><span class="asset-price">${kind === "cakes" ? p.diameterCm + " см · " + p.layers.length + " слоёв" : kind === "flowers" ? { round: "Круглый", garden: "Садовый", bridal: "Свадебный", cascade: "Каскадный", line: "Вытянутый", minimal: "Минималистичный", hatbox: "В коробке", basket: "В корзине" }[p.form] : { ring: "Кольцо", earring: "Серьги", pendant: "Подвеска", bracelet: "Браслет", chain: "Цепочка" }[p.type]}</span></button>`,
        )
        .join("") +
      `<button class="asset-card ${!state.pattern ? "is-selected" : ""}" data-pattern=""><span class="asset-name">Свободная сборка</span><span class="asset-price">Все исходные детали · свои сочетания</span></button>`;
    $("#stone-filter").hidden = true;
    return;
  }
  if (pattern && kind === "cakes" && category === "decor") {
    $("#catalog-count").textContent =
      pattern.compatibleDecor.length + " сочетаний";
    $("#catalog").innerHTML = pattern.compatibleDecor
      .map((id) => {
        const c = ingredients[id];
        return `<button class="asset-card ${state.foodDecor.includes(id) ? "is-selected" : ""}" data-food="${id}"><span class="asset-image"><img src="../shared/${c.asset ? byId[c.asset].thumbnail : "domain-thumbnails/component-" + id + ".jpg"}" alt="" width="120" height="120"></span><span class="asset-name">${esc(c.name)}</span><span class="asset-price">Подходит к рецептуре</span></button>`;
      })
      .join("");
    $("#stone-filter").hidden = true;
    return;
  }
  if (
    pattern &&
    kind === "flowers" &&
    ["flowers", "green"].includes(category)
  ) {
    const ids =
      category === "flowers"
        ? [...pattern.roles.focal, ...pattern.roles.secondary]
        : [...pattern.roles.filler, ...pattern.roles.foliage];
    $("#catalog-count").textContent = ids.length + " видов";
    $("#catalog").innerHTML = ids
      .map((id) => {
        const p = plants[id];
        return `<article class="asset-card is-selected"><span class="asset-image"><img src="../shared/${p.asset && byId[p.asset] ? byId[p.asset].thumbnail : "domain-thumbnails/plant-" + id + ".jpg"}" alt="" width="120" height="120"></span><span class="asset-name">${esc(p.name)}</span><span class="asset-price">${{ focal: "Главный цветок", secondary: "Вторичный цветок", filler: "Воздушный наполнитель", foliage: "Зелень", line: "Направление", mass: "Объём" }[p.role]}</span></article>`;
      })
      .join("");
    $("#stone-filter").hidden = true;
    return;
  }
  const selected = new Set(selectedIds(kind, state));
  const entries = catalogue.filter(
    (a) =>
      a.project === kind &&
      a.category === category &&
      (!pattern ||
        kind !== "flowers" ||
        category !== "pack" ||
        (pattern.form === "hatbox"
          ? a.id === "fl-wrap-hatbox-round"
          : pattern.form === "basket"
            ? a.id === "fl-wrap-basket-rattan"
            : ["bridal", "cascade"].includes(pattern.form)
              ? false
              : !a.id.includes("hatbox") && !a.id.includes("basket"))) &&
      (!pattern ||
        kind !== "cakes" ||
        category !== "topper" ||
        ["sponge", "mini"].includes(pattern.type)) &&
      (kind !== "jewelry" ||
        category !== "stone" ||
        compatibleStones(state).some((x) => x.id === a.id)) &&
      (kind !== "jewelry" ||
        category !== "setting" ||
        compatibleSettings(state).some((x) => x.id === a.id)) &&
      (!query ||
        (a.name + " " + (a.variant || "")).toLowerCase().includes(query)) &&
      (category !== "stone" ||
        stoneFilter === "all" ||
        (stoneFilter === "diamond" && a.pack === "diamond") ||
        (stoneFilter === "gem" && a.pack === "gem") ||
        (stoneFilter === "cabochon" && a.name.includes("кабошон"))),
  );
  entries.sort((a, b) => {
    if (category === "base" && kind === "cakes")
      return (
        Number(b.id.includes("-struct-")) - Number(a.id.includes("-struct-"))
      );
    if (category === "base" && kind === "jewelry")
      return Number(b.id === state.base) - Number(a.id === state.base);
    return 0;
  });
  $("#catalog-count").textContent =
    entries.length +
    " " +
    (category === "stone" ? "огранок и оттенков" : "вариантов");
  $("#catalog").innerHTML = entries.length
    ? entries
        .map(
          (a) =>
            `<button class="asset-card ${selected.has(a.id) ? "is-selected" : ""}" data-asset="${a.id}" aria-pressed="${selected.has(a.id)}" aria-label="${esc(a.name + (a.variant ? " · " + a.variant : ""))}"><span class="asset-image"><img src="../shared/${a.thumbnail}" alt="" loading="lazy" width="120" height="120"><span class="asset-check" aria-hidden="true">✓</span></span><span class="asset-name">${esc(a.name)}</span>${a.variant ? `<span class="asset-variant"><i style="background:${a.color}"></i>${esc(a.variant)}</span>` : `<span class="asset-price">${a.price} BYN${category === "flowers" ? " / стебель" : ""}</span>`}</button>`,
        )
        .join("")
    : `<p class="empty">${query ? "Ничего не найдено. Попробуйте другое название." : kind === "jewelry" && category === "setting" ? "В это изделие уже встроена оправа. Отдельный каст можно выбрать для гладкого кольца, тонкого кольца или цепочки." : kind === "jewelry" && category === "stone" ? "У этого изделия нет гнёзд для камней. Выберите модель со вставками." : "Нет подходящих деталей для этого состава."}</p>`;
  $("#stone-filter").hidden = category !== "stone";
  if (
    pattern &&
    kind === "flowers" &&
    category === "pack" &&
    ["bridal", "cascade"].includes(pattern.form)
  )
    $("#catalog").innerHTML =
      '<p class="empty">Стебли этого букета перевязаны лентой. Бумажная упаковка не требуется.</p>';
  if (pattern && kind === "jewelry" && category === "finding")
    $("#catalog").innerHTML =
      '<p class="empty">Фурнитура включена в конструкцию: замки, соединения и штифты соответствуют выбранному изделию.</p>';
}
function renderUI() {
  $(".panel-badge").textContent =
    String(spec.categories.findIndex(([id]) => id === category) + 1).padStart(
      2,
      "0",
    ) +
    " / " +
    String(spec.categories.length).padStart(2, "0");
  document.querySelectorAll("[data-category]").forEach((b) => {
    b.setAttribute("aria-selected", String(b.dataset.category === category));
    b.classList.toggle("is-active", b.dataset.category === category);
    b.tabIndex = b.dataset.category === category ? 0 : -1;
  });
  $("#price").textContent = money(estimate(kind, state));
  $("#summary").textContent = describe(kind, state);
  $("#undo").disabled = !history.length;
  $("#redo").disabled = !future.length;
  const nativeMaterial =
    (kind === "cakes" && state.base.includes("pastry")) ||
    (kind === "flowers" &&
      state.flowers.every((id) => id === "fl-flower-chamomile"));
  const materialHeading = $(".material-options .section-line h3"),
    materialCaption = $(".material-options .section-line span");
  materialHeading.textContent = nativeMaterial
    ? "Природные оттенки"
    : kind === "cakes"
      ? "Оттенок крема"
      : kind === "flowers"
        ? "Палитра лепестков"
        : "Металл";
  materialCaption.textContent = nativeMaterial ? "Сохранены" : "Ваш оттенок";
  $("#palette").innerHTML = nativeMaterial
    ? `<p class="small-hint">${kind === "cakes" ? "Сохранены исходные цвета теста, крема и шоколада." : "Белые лепестки и жёлтые сердцевины ромашек сохраняют природный цвет."}</p>`
    : spec.palette
        .map(
          ([name, color], i) =>
            `<button class="swatch" data-palette="${i}" aria-pressed="${state.palette === i}" aria-label="${name}" title="${name}"><i style="background:${color}"></i><span>${name}</span></button>`,
        )
        .join("");
  const rows = selectedIds(kind, state);
  $("#ingredients").innerHTML = rows
    .map((id) => {
      const a = byId[id],
        count = ["glaze", "border"].includes(a.role) ? null : state.counts[id],
        removable =
          !["base", "pack"].includes(a.category) &&
          !(a.category === "flowers" && state.flowers.length === 1);
      return `<li><img src="../shared/${a.thumbnail}" alt="" width="34" height="34"><span>${esc(a.name)}${a.variant ? `<small>${esc(a.variant)}</small>` : ""}</span>${kind === "jewelry" && a.category === "stone" ? `<small>${state.base === "jw-set-pave-band" ? "44 вставки" : state.base === "jw-base-cocktail" ? "2 вставки" : "1 вставка"}</small>` : ""}${count ? `<div class="counter"><button data-count="${id}" data-delta="-1" ${count <= 1 ? "disabled" : ""} aria-label="Уменьшить: ${esc(a.name)}">−</button><output>${count}</output><button data-count="${id}" data-delta="1" ${!canIncreaseCount(kind, state, id) ? "disabled" : ""} aria-label="Добавить: ${esc(a.name)}">+</button></div>` : ""}${removable ? `<button class="remove" data-remove="${id}" aria-label="Убрать: ${esc(a.name)}">×</button>` : ""}</li>`;
    })
    .join("");
  $("#selected-count").textContent = rows.length + " деталей";
  $("#dimension-options").innerHTML =
    kind === "cakes"
      ? `<p class="small-hint">Крупный декор для мини-десертов размещается на тарелке. Количество ограничивается свободным местом.</p><label>${state.base.includes("pastry") ? "В наборе" : "Ярусов"}<select data-config="${state.base.includes("pastry") ? "pieces" : "tiers"}">${(state.base.includes("pastry") ? [1, 4, 6] : [1, 2, 3]).map((v) => `<option ${v === state[state.base.includes("pastry") ? "pieces" : "tiers"] ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>Композиция<select data-config="layout"><option value="crescent" ${state.layout === "crescent" ? "selected" : ""}>Полумесяц</option><option value="wreath" ${state.layout === "wreath" ? "selected" : ""}>Венок</option><option value="center" ${state.layout === "center" ? "selected" : ""}>В центре</option></select></label>${
          !state.base.includes("pastry")
            ? `<label>Начинка · за ярус<select data-config="filling">${Object.entries(
                {
                  vanilla: "Ваниль",
                  berry: "Малина +8 BYN",
                  chocolate: "Шоколад +10 BYN",
                  pistachio: "Фисташка +16 BYN",
                },
              )
                .map(
                  ([id, name]) =>
                    `<option value="${id}" ${state.filling === id ? "selected" : ""}>${name}</option>`,
                )
                .join("")}</select></label>`
            : ""
        }`
      : kind === "jewelry"
        ? `<label ${["jw-base-band-plain", "jw-base-cocktail", "jw-base-signet", "jw-base-solitaire", "jw-base-stacking-thin", "jw-set-bezel", "jw-set-halo"].includes(state.base) ? "" : "hidden"}>Размер кольца<select data-config="size">${[16, 17, 18, 19, 20].map((v) => `<option ${state.size === v ? "selected" : ""}>${v}</option>`).join("")}</select></label><p class="small-hint">${state.base === "jw-set-pave-band" ? "44 круглые вставки. Выбранный оттенок применяется ко всем гнёздам." : state.base === "jw-base-cocktail" ? "Две круглые вставки одного оттенка." : "Каталог показывает камни и оправы, подходящие к выбранному изделию."}</p>`
        : `<p class="small-hint">Число стеблей каждого сорта меняется в составе. Добавьте до пяти видов цветов, всего до 33 стеблей.</p>`;
  renderCatalog();
  const patterns = patternLists[kind];
  const active = resolvePattern(kind, state.pattern);
  const controls = document.createElement("div");
  controls.className = "domain-controls";
  controls.innerHTML = `<label>${kind === "cakes" ? "Рецептура и конструкция" : kind === "flowers" ? "Флористическая композиция" : "Конструкция изделия"}<select data-config="pattern">${!active ? '<option value="">Выберите конструкцию</option>' : ""}${patterns.map((p) => `<option value="${p.id}" ${p.id === state.pattern ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>${active && kind === "cakes" ? `<p class="small-hint">${active.layers.map((l) => `${ingredients[l.component].name} ${l.thicknessCm} см`).join(" → ")}${active.cover ? " · " + ingredients[active.cover].name : ""}</p>` : ""}`;
  if (active) {
    $("#selected-count").textContent =
      kind === "flowers"
        ? Object.values(state.taxonCounts).reduce((n, v) => n + v, 0) +
          " стеблей"
        : kind === "cakes"
          ? active.layers.length + state.foodDecor.length + " компонентов"
          : active.name;
    const small =
      kind === "cakes" &&
      [
        "macaron",
        "eclair",
        "profiterole",
        "paris-brest",
        "cupcake",
        "donut",
        "cookie",
        "brownie",
      ].includes(active.type);
    $("#dimension-options").innerHTML =
      kind === "cakes"
        ? `<label>${small ? "В наборе" : "Ярусов"}<select data-config="${small ? "pieces" : "tiers"}">${(small ? [1, 4, 6] : Array.from({ length: active.maxTiers }, (_, i) => i + 1)).map((v) => `<option ${v === state[small ? "pieces" : "tiers"] ? "selected" : ""}>${v}</option>`).join("")}</select></label>`
        : kind === "flowers"
          ? `<label>Объём букета<select data-config="bouquetSize">${[11, 19, 29].map((v) => `<option value="${v}" ${v === state.bouquetSize ? "selected" : ""}>${{ 11: "Небольшой", 19: "Средний", 29: "Пышный" }[v]}</option>`).join("")}</select></label>`
          : `${active.type === "ring" ? `<label>Размер кольца<select data-config="size">${[16, 17, 18, 19, 20].map((v) => `<option ${v === state.size ? "selected" : ""}>${v}</option>`).join("")}</select></label>` : ""}<label>Поверхность<select data-config="finish">${Object.entries(
              {
                polished: "Полировка",
                satin: "Матовая",
                brushed: "Сатинирование",
                hammered: "Чеканка",
              },
            )
              .map(
                ([id, name]) =>
                  `<option value="${id}" ${state.finish === id ? "selected" : ""}>${name}</option>`,
              )
              .join("")}</select></label>`;
    if (kind === "cakes")
      $("#ingredients").innerHTML =
        active.layers
          .map(
            (l) =>
              `<li><span>${esc(ingredients[l.component].name)}</span><small>${l.thicknessCm} см</small></li>`,
          )
          .join("") +
        state.foodDecor
          .map(
            (id) =>
              `<li><span>${esc(ingredients[id].name)}</span><div class="counter"><button data-food-count="${id}" data-delta="-1" ${state.foodCounts[id] <= 1 ? "disabled" : ""}>−</button><output>${state.foodCounts[id]}</output><button data-food-count="${id}" data-delta="1" aria-label="Добавить ${esc(ingredients[id].name)}" ${normalize(kind, { ...state, foodCounts: { ...state.foodCounts, [id]: state.foodCounts[id] + 1 } }).foodCounts[id] <= state.foodCounts[id] ? "disabled" : ""}>+</button></div><button class="remove" data-food-remove="${id}" aria-label="Убрать ${esc(ingredients[id].name)}">×</button></li>`,
          )
          .join("");
    if (kind === "flowers")
      $("#ingredients").innerHTML = Object.entries(state.taxonCounts)
        .map(
          ([id, count]) =>
            `<li><span>${esc(plants[id].name)}</span><div class="counter"><button data-taxon-count="${id}" aria-label="Уменьшить ${esc(plants[id].name)}" data-delta="-1" ${count <= 1 ? "disabled" : ""}>−</button><output>${count}</output><button data-taxon-count="${id}" aria-label="Добавить ${esc(plants[id].name)}" data-delta="1" ${count >= 33 || Object.values(state.taxonCounts).reduce((n, v) => n + v, 0) >= 33 ? "disabled" : ""}>+</button></div></li>`,
        )
        .join("");
    if (kind === "jewelry")
      $("#ingredients").innerHTML =
        `<li><span>${esc(active.name)}</span></li>${state.stone ? `<li><span>${esc(byId[state.stone].name)} · ${esc(byId[state.stone].variant || "")}</span><small>${active.stoneSizeMm} мм</small></li>` : ""}<li><span>${esc(active.fixedMetals ? "Жёлтое, белое и розовое золото" : spec.palette[state.palette][0])}</span><small>${{ polished: "Полировка", satin: "Матовая", brushed: "Сатинирование", hammered: "Чеканка" }[state.finish]}</small></li>`;
  }
  $("#dimension-options").prepend(controls);
  if (active && kind === "cakes" && active.compatibleCovers)
    $("#dimension-options").insertAdjacentHTML(
      "beforeend",
      `<label>Покрытие<select data-config="cover">${active.compatibleCovers.map((id) => `<option value="${id}" ${state.cover === id ? "selected" : ""}>${ingredients[id].name}</option>`).join("")}</select></label>`,
    );
  if (
    active &&
    kind === "cakes" &&
    !["cream-coat", "sugar-fondant"].includes(state.cover)
  ) {
    materialHeading.textContent = "Покрытие рецептуры";
    materialCaption.textContent = "Выбрано";
    $("#palette").innerHTML =
      `<p class="small-hint">${state.cover ? ingredients[state.cover].name : "Без дополнительного покрытия"}. Цвет теста, крема и ягод сохраняется.</p>`;
  }
  if (active?.fixedMetals) {
    materialHeading.textContent = "Три металла";
    materialCaption.textContent = "Комплект";
    $("#palette").innerHTML =
      '<p class="small-hint">Жёлтое, белое и розовое золото. Три отдельных кольца, которые можно носить вместе.</p>';
  }
}
$("#categories").innerHTML = spec.categories
  .map(
    ([id, name], i) =>
      `<button role="tab" id="tab-${id}" aria-controls="catalog" data-category="${id}" aria-selected="false"><span>0${i + 1}</span>${name}</button>`,
  )
  .join("");
$("#presets").innerHTML = spec.presets
  .map(
    ([name, detail], i) =>
      `<button data-preset="${i}"><img src="../shared/domain-thumbnails/${kind}-${presetPatterns[kind][i]}.jpg" alt=""><span>${name}<small>${detail}</small></span><b aria-hidden="true">↗</b></button>`,
  )
  .join("");
$("#categories").onclick = (e) => {
  const b = e.target.closest("[data-category]");
  if (!b) return;
  category = b.dataset.category;
  query = "";
  $("#search").value = "";
  renderUI();
};
$("#catalog").onclick = (e) => {
  const patternButton = e.target.closest("[data-pattern]"),
    food = e.target.closest("[data-food]");
  if (patternButton) {
    change({
      ...state,
      pattern: patternButton.dataset.pattern,
      palette: kind === "flowers" ? undefined : state.palette,
      stone: undefined,
      foodDecor: undefined,
      foodCounts: undefined,
      taxonCounts: undefined,
    });
    return;
  }
  if (food) {
    const id = food.dataset.food;
    change({
      ...state,
      foodDecor: state.foodDecor.includes(id)
        ? state.foodDecor.filter((x) => x !== id)
        : [...state.foodDecor, id],
    });
    return;
  }
  const b = e.target.closest("[data-asset]");
  if (b) {
    const a = byId[b.dataset.asset];
    if (a.category === "base") {
      const mapping =
        kind === "cakes"
          ? {
              "bk-pastry-cupcake": "tiramisu-cupcake",
              "bk-pastry-donut": "vanilla-doughnut",
              "bk-pastry-eclair": "vanilla-eclair",
              "bk-pastry-profiterole": "cream-puff",
              "bk-pastry-cookie-round": "iced-cookie-round",
              "bk-pastry-cookie-heart": "iced-cookie-heart",
              "bk-pastry-brownie-bite": "fudge-brownie",
              "bk-struct-tier-round": "vanilla-celebration",
              "bk-struct-tier-hex": "vanilla-celebration",
            }
          : kind === "jewelry"
            ? {
                "jw-base-solitaire": "solitaire",
                "jw-base-band-plain": "wedding-band",
                "jw-base-stacking-thin": "pave-band",
                "jw-base-cocktail": "trilogy",
                "jw-base-cuff-bracelet": "bangle",
                "jw-base-ear-cuff": "hoop",
                "jw-base-stud-earring": "stud",
                "jw-base-drop-earring": "drop",
                "jw-base-pendant": "bezel-pendant",
                "jw-base-chain-link-cable": "cable-chain",
                "jw-set-bezel": "bezel-ring",
                "jw-set-halo": "halo-ring",
                "jw-set-pave-band": null,
              }
            : {};
      if (state.pattern && mapping[a.id]) {
        change({
          ...state,
          base: a.id,
          pattern: mapping[a.id],
          stone: undefined,
          foodDecor: undefined,
          foodCounts: undefined,
          taxonCounts: undefined,
        });
        return;
      }
      change({ ...toggleAsset(kind, state, a.id), pattern: null });
      return;
    }
    if (
      a.category === "flowers" &&
      !state.flowers.includes(a.id) &&
      state.flowers.length >= 5
    ) {
      status.textContent =
        "Можно сочетать не более пяти сортов. Уберите один из состава.";
      return;
    }
    change(toggleAsset(kind, state, a.id));
  }
};
$("#search").oninput = (e) => {
  query = e.target.value.toLocaleLowerCase("ru-RU").trim();
  renderCatalog();
};
$("#stone-filter").onchange = (e) => {
  stoneFilter = e.target.value;
  renderCatalog();
};
$("#palette").onclick = (e) => {
  const b = e.target.closest("[data-palette]");
  if (b) change({ ...state, palette: Number(b.dataset.palette) });
};
$("#dimension-options").onchange = (e) => {
  if (e.target.dataset.config) {
    const key = e.target.dataset.config;
    change({
      ...state,
      ...(key === "pattern"
        ? {
            stone: undefined,
            palette: kind === "flowers" ? undefined : state.palette,
            foodDecor: undefined,
            foodCounts: undefined,
            taxonCounts: undefined,
          }
        : key === "bouquetSize"
          ? { taxonCounts: undefined }
          : {}),
      [key]: ["layout", "filling", "pattern", "finish", "cover"].includes(key)
        ? e.target.value
        : Number(e.target.value),
    });
  }
};
$("#ingredients").onclick = (e) => {
  const food = e.target.closest("[data-food-count]"),
    removeFood = e.target.closest("[data-food-remove]"),
    taxon = e.target.closest("[data-taxon-count]");
  if (food) {
    const id = food.dataset.foodCount;
    change({
      ...state,
      foodCounts: {
        ...state.foodCounts,
        [id]: state.foodCounts[id] + Number(food.dataset.delta),
      },
    });
    return;
  }
  if (removeFood) {
    change({
      ...state,
      foodDecor: state.foodDecor.filter(
        (id) => id !== removeFood.dataset.foodRemove,
      ),
    });
    return;
  }
  if (taxon) {
    const id = taxon.dataset.taxonCount;
    change({
      ...state,
      taxonCounts: {
        ...state.taxonCounts,
        [id]: state.taxonCounts[id] + Number(taxon.dataset.delta),
      },
    });
    return;
  }
  const count = e.target.closest("[data-count]"),
    remove = e.target.closest("[data-remove]");
  if (count) {
    const id = count.dataset.count;
    change({
      ...state,
      counts: {
        ...state.counts,
        [id]: (state.counts[id] || 1) + Number(count.dataset.delta),
      },
    });
  }
  if (remove) change(toggleAsset(kind, state, remove.dataset.remove));
};
$("#presets").onclick = (e) => {
  const b = e.target.closest("[data-preset]");
  if (b) change(preset(kind, Number(b.dataset.preset)));
};
$("#undo").onclick = () => {
  if (!history.length) return;
  future.push(structuredClone(state));
  change(history.pop(), false);
};
$("#redo").onclick = () => {
  if (!future.length) return;
  history.push(structuredClone(state));
  change(future.pop(), false);
};
$("#reset").onclick = () => change(preset(kind, 0));
$("#save").onclick = () => {
  persist();
  status.textContent = "Черновик сохранён на этом устройстве";
};
async function rebuild() {
  if (!renderer) return;
  if (renderer.renderer.getContext().isContextLost()) return;
  const generation = ++ticket,
    s = structuredClone(state),
    created = [];
  loading = true;
  failed = false;
  $("#viewer").setAttribute("aria-busy", "true");
  $("#add-cart").disabled = true;
  $("#snapshot").disabled = true;
  status.textContent = "Собираем детали…";
  const buildLibrary = {
    get: async (...args) => {
      const item = await library.get(...args);
      created.push(item);
      return item;
    },
  };
  try {
    const next = await assembleProject(
      buildLibrary,
      kind,
      s,
      spec.palette[s.palette][1],
    );
    if (generation !== ticket) {
      disposeTree(next);
      return;
    }
    renderer.setObject(next, {
      reset:
        !assembly ||
        s.pattern !== assembly.pattern ||
        s.base !== assembly.base ||
        s.pack !== assembly.pack,
    });
    assembly = s;
    $("#fallback").hidden = true;
    $("#canvas").hidden = false;
    $("#viewer").dataset.ready = "true";
    $("#measure").textContent = next.userData.measure;
    status.textContent =
      fitNotice || "Готово. Вращайте модель, чтобы рассмотреть детали.";
    $("#retry").hidden = true;
  } catch (e) {
    created.forEach(disposeTree);
    if (generation !== ticket) return;
    failed = true;
    status.textContent =
      "Не удалось загрузить одну из деталей. Повторите загрузку.";
    $("#retry").hidden = false;
    console.error(e);
  } finally {
    if (generation === ticket) {
      loading = false;
      $("#viewer").setAttribute("aria-busy", "false");
      $("#add-cart").disabled = failed;
      $("#snapshot").disabled = failed;
    }
  }
}
$("#retry").onclick = rebuild;
document.querySelectorAll("[data-pose]").forEach(
  (b) =>
    (b.onclick = () => {
      renderer?.fit(b.dataset.pose);
      document
        .querySelectorAll("[data-pose]")
        .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    }),
);
$("#rotate").onclick = () => {
  rotating = !rotating;
  renderer?.rotate(rotating);
  $("#rotate").setAttribute("aria-pressed", String(rotating));
};
$("#snapshot").onclick = () => {
  if (!renderer) return;
  renderer.renderer.render(renderer.scene, renderer.camera);
  const a = document.createElement("a");
  a.href = $("#canvas").toDataURL("image/png");
  a.download = kind + "-design.png";
  a.click();
};
$("#download").onclick = () => {
  const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              project: kind,
              configuration: state,
              estimateBYN: estimate(kind, state),
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = kind + "-design.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("#add-cart").onclick = async () => {
  const config = structuredClone(state);
  $("#add-cart").disabled = true;
  try {
    const k = `igdemo_${kind}_cart_v1`,
      before = JSON.parse(localStorage.getItem(k) || "[]"),
      draft = cartLine(kind, config),
      existing =
        Array.isArray(before) && before.find((x) => x?.id === draft.id),
      image =
        existing?.img ||
        (renderer
          ? await saveShot(
              kind,
              $("#canvas"),
              kind === "jewelry"
                ? "#22221f"
                : kind === "flowers"
                  ? "#eee9e2"
                  : "#f5e9df",
            )
          : undefined);
    localStorage.setItem(
      k,
      JSON.stringify(
        (editingId ? replaceCartDesign : mergeCart)(
          JSON.parse(localStorage.getItem(k) || "[]"),
          cartLine(kind, config, image),
          editingId,
        ),
      ),
    );
    $("#cart-link").hidden = false;
    if (editingId) {
      editingId = draft.id;
      const url = new URL(location.href);
      url.searchParams.set("edit", editingId);
      globalThis.history.replaceState(null, "", url);
    }
    status.textContent = "Ваш дизайн в корзине. Можно перейти к оформлению.";
  } catch {
    status.textContent =
      "Сохранение корзины недоступно. Скачайте конфигурацию.";
  } finally {
    $("#add-cart").disabled = loading;
  }
};
try {
  renderer = new StudioRenderer($("#canvas"), $("#viewer"), kind);
  $("#viewer").addEventListener("contextlost", () => {
    ++ticket;
    loading = false;
    failed = true;
    $("#fallback").hidden = false;
    $("#canvas").hidden = true;
    $("#add-cart").disabled = true;
    $("#snapshot").disabled = true;
    status.textContent = "3D временно недоступно. Состав сохранён.";
  });
  $("#viewer").addEventListener("contextrestored", rebuild);
  rebuild();
} catch {
  renderer?.dispose();
  renderer = null;
  $("#viewer").setAttribute("aria-busy", "false");
  status.textContent = "3D недоступно. Выберите состав по фотографиям деталей.";
  document
    .querySelectorAll("[data-pose],#rotate,#snapshot")
    .forEach((b) => (b.disabled = true));
}
window.studioReview = {
  component: (type, id) => {
    const object =
      type === "food"
        ? foodDetail(id)
        : plants[id].role === "foliage" || plants[id].role === "filler"
          ? botanicalBranch(plants[id], 8)
          : botanicalHead(plants[id]);
    renderer.setObject(object);
    renderer.fit("front");
    return object.userData;
  },
  freeze: () => {
    cancelAnimationFrame(renderer.raf);
    renderer.loop = () => {};
    renderer.renderer.setPixelRatio(1);
  },
  getState: () => structuredClone(state),
  setState: (next) => change(next),
  preset: (i) => change(preset(kind, i)),
  ready: () => !loading && !failed,
  pose: (p) => renderer?.fit(p),
  metrics: () => renderer?.metrics(),
  catalogue: catalogue.filter((a) => a.project === kind),
};
window.addEventListener("pagehide", (e) => {
  if (e.persisted) return;
  ++ticket;
  renderer?.dispose();
  library.dispose();
});
renderUI();

const previewButton = document.createElement("button");
previewButton.className = "expand-preview";
previewButton.textContent = "Развернуть ↗";
previewButton.setAttribute("aria-label", "Вернуться к большому предпросмотру");
$("#viewer").append(previewButton);
previewButton.onclick = () =>
  $(".stage-shell").scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "start",
  });
let scrollQueued = false;
function compactPreview() {
  scrollQueued = false;
  const shell = $(".stage-shell"),
    panel = $(".design-panel"),
    floating =
      innerWidth <= 850 &&
      shell.getBoundingClientRect().bottom < 90 &&
      panel.getBoundingClientRect().bottom > 180;
  $("#viewer").classList.toggle("is-floating", floating);
  shell.classList.toggle("has-floating", floating);
}
addEventListener(
  "scroll",
  () => {
    if (!scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(compactPreview);
    }
  },
  { passive: true },
);
addEventListener("resize", compactPreview);

$("#catalog").setAttribute("role", "tabpanel");
$("#categories").addEventListener("keydown", (e) => {
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
  if (!keys.includes(e.key)) return;
  e.preventDefault();
  const tabs = [...$("#categories").querySelectorAll("button")],
    index = tabs.indexOf(document.activeElement),
    next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) %
            tabs.length;
  tabs[next].click();
  tabs[next].focus();
});
