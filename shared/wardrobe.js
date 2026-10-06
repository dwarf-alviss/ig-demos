const $ = (s) => document.querySelector(s),
  products = window.LINIA_DATA.products.map((p) => ({
    ...p,
    img: "assets/img/looks/" + p.id + ".svg",
    alt: "Эскиз силуэта: " + p.name,
  }));
const groups = [
  { label: "01 / Верх", cats: ["shirt", "blouse", "knit", "top"] },
  { label: "02 / Основа", cats: ["pants", "jeans", "skirt", "dress"] },
  { label: "03 / Второй слой", cats: ["jacket", "suit", "coat", "cardigan"] },
].map((g) => ({ ...g, items: products.filter((p) => g.cats.includes(p.cat)) }));
let state = {
  items: groups.map((g, i) =>
    i === 1 ? "p-jeans-classic" : i === 2 ? "p-suit-forma" : g.items[0]?.id,
  ),
  size: "M",
};
try {
  const s = JSON.parse(localStorage.getItem("portfolio-wardrobe-v2"));
  if (
    s?.items?.length === 3 &&
    s.items.every((id, i) => groups[i].items.some((p) => p.id === id)) &&
    ["XS", "S", "M", "L", "XL"].includes(s.size)
  )
    state = s;
} catch {}
$("#choices").innerHTML = groups
  .map(
    (g, i) =>
      `<fieldset><legend>${g.label}</legend><div>${g.items.map((p) => `<button data-group="${i}" data-item="${p.id}" aria-pressed="false">${p.name}</button>`).join("")}</div></fieldset>`,
  )
  .join("");
$("#sizes").innerHTML = ["XS", "S", "M", "L", "XL"]
  .map(
    (size) =>
      `<button data-size="${size}" aria-pressed="false">${size}</button>`,
  )
  .join("");
const selected = () =>
  state.items.map((id) => products.find((p) => p.id === id));
const tones = {
  black: ["Чёрный", "#363734"],
  graphite: ["Графит", "#555954"],
  grey: ["Серый", "#9c9e96"],
  milk: ["Молочный", "#e2dece"],
  blue: ["Синий", "#637e8e"],
  beige: ["Бежевый", "#c4b497"],
  olive: ["Олива", "#76806a"],
};
state.colors = state.items.map((id, i) => {
  const p = products.find((p) => p.id === id);
  return p.colors.includes(state.colors?.[i]) ? state.colors[i] : p.colors[0];
});
const colorChoices = document.createElement("div");
colorChoices.id = "color-choices";
$("#sizes").parentElement.before(colorChoices);
function render() {
  const items = selected();
  colorChoices.innerHTML = items
    .map(
      (p, i) =>
        `<fieldset><legend>Оттенок / ${p.name}</legend><div>${p.colors.map((c) => `<button class="color-choice" data-color="${c}" data-color-group="${i}" aria-pressed="${state.colors[i] === c}"><i style="background:${tones[c][1]}"></i>${tones[c][0]}</button>`).join("")}</div></fieldset>`,
    )
    .join("");
  $("#look").innerHTML = items
    .map(
      (p, i) =>
        `<figure><img src="assets/img/looks/${p.id}-${state.colors[i]}.svg" alt="${p.alt}"><figcaption><small>0${i + 1} / ${groups[i].label.split(" / ")[1]}</small>${p.name}<span>${p.price} BYN</span></figcaption></figure>`,
    )
    .join("");
  $("#price").textContent = items.reduce((n, p) => n + p.price, 0) + " BYN";
  $("#summary").innerHTML = items
    .map(
      (p) =>
        `<span class="availability"><b>${p.name}</b> · ${p.sizes.includes(state.size) ? "Размер " + state.size : "Размер " + state.size + " недоступен"}<small>${p.fabric.split(".")[0]}<br>Призма: ${p.stock.prisma} · МОМО: ${p.stock.momo}</small></span>`,
    )
    .join("");
  document
    .querySelectorAll("[data-group]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(state.items[Number(b.dataset.group)] === b.dataset.item),
      ),
    );
  document
    .querySelectorAll("[data-size]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(state.size === b.dataset.size)),
    );
  $("#add-capsule").disabled = items.some(
    (p) =>
      !p.sizes.includes(state.size) ||
      !Object.values(p.stock).some((n) => n > 0),
  );
  $("#count").textContent = "03 ВЕЩИ / " + state.size;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.group !== undefined) {
    const i = Number(b.dataset.group);
    state.items[i] = b.dataset.item;
    state.colors[i] = products.find((p) => p.id === b.dataset.item).colors[0];
  }
  if (b.dataset.color) {
    state.colors[Number(b.dataset.colorGroup)] = b.dataset.color;
  }
  if (b.dataset.size) state.size = b.dataset.size;
  render();
});
$("#save").onclick = () => {
  try {
    localStorage.setItem("portfolio-wardrobe-v2", JSON.stringify(state));
    $("#status").textContent = "Капсула сохранена на этом устройстве.";
  } catch {
    $("#status").textContent = "Сохранение недоступно.";
  }
};
$("#add-capsule").onclick = () => {
  if ($("#add-capsule").disabled) return;
  try {
    const key = "igdemo_fashion_cart_v1",
      value = JSON.parse(localStorage.getItem(key) || "[]"),
      cart = Array.isArray(value) ? value : [];
    for (const [i, p] of selected().entries()) {
      const color = state.colors[i],
        id = p.id + "|" + state.size + "|" + color,
        old = cart.find((x) => x.key === id);
      if (old) old.qty = Math.min(99, old.qty + 1);
      else
        cart.push({
          key: id,
          id: p.id,
          name: p.name,
          price: p.price,
          qty: 1,
          size: state.size,
          color,
          img: `assets/img/looks/${p.id}-${color}.svg`,
        });
    }
    localStorage.setItem(key, JSON.stringify(cart));
    $("#status").innerHTML =
      'Три вещи добавлены. <a href="cart.html">Перейти в корзину →</a>';
  } catch {
    $("#status").textContent = "Браузер не разрешает сохранение корзины.";
  }
};
render();
