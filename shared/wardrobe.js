const groups = [
  {
    label: "01 / Верх",
    items: [
      ["Рубашка", "shirt.jpg", 129],
      ["Трикотаж", "knit.jpg", 119],
      ["Блуза", "blouse.jpg", 109],
    ],
  },
  {
    label: "02 / Основа",
    items: [
      ["Деним", "denim.jpg", 149],
      ["Базовый трикотаж", "knit.jpg", 119],
    ],
  },
  {
    label: "03 / Акцент",
    items: [
      ["Сумка", "bag.jpg", 89],
      ["Рубашка вторым слоем", "shirt.jpg", 129],
    ],
  },
];
const $ = (s) => document.querySelector(s),
  sizes = ["XS", "S", "M", "L", "XL"];
let state = { items: [0, 0, 0], size: "M" };
try {
  const saved = JSON.parse(localStorage.getItem("portfolio-wardrobe-v1"));
  if (
    saved?.items?.length === 3 &&
    saved.items.every(
      (n, i) => Number.isInteger(n) && n >= 0 && n < groups[i].items.length,
    ) &&
    sizes.includes(saved.size)
  )
    state = saved;
} catch {}
$("#choices").innerHTML = groups
  .map(
    (g, i) =>
      `<fieldset><legend>${g.label}</legend><div>${g.items.map((item, j) => `<button data-group="${i}" data-item="${j}" aria-pressed="false">${item[0]}</button>`).join("")}</div></fieldset>`,
  )
  .join("");
$("#sizes").innerHTML = sizes
  .map((s) => `<button data-size="${s}" aria-pressed="false">${s}</button>`)
  .join("");
function render() {
  const selected = groups.map((g, i) => g.items[state.items[i]]);
  $("#look").innerHTML = selected
    .map(
      (item, i) =>
        `<figure><img src="assets/img/${item[1]}" alt="${item[0]}"><figcaption>0${i + 1} / ${item[0]} <span>${item[2]} BYN</span></figcaption></figure>`,
    )
    .join("");
  $("#price").textContent = selected.reduce((s, i) => s + i[2], 0) + " BYN";
  $("#summary").textContent =
    selected.map((i) => i[0]).join(" + ") + ` · размер ${state.size}`;
  document
    .querySelectorAll("[data-group]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(state.items[Number(b.dataset.group)] === Number(b.dataset.item)),
      ),
    );
  document
    .querySelectorAll("[data-size]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(state.size === b.dataset.size)),
    );
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.group !== undefined) {
    state.items[Number(b.dataset.group)] = Number(b.dataset.item);
    render();
  }
  if (b.dataset.size) {
    state.size = b.dataset.size;
    render();
  }
});
$("#save").onclick = () => {
  try {
    localStorage.setItem("portfolio-wardrobe-v1", JSON.stringify(state));
    $("#status").textContent =
      "Капсула сохранена. Вернитесь к ней в любой момент.";
  } catch {
    $("#status").textContent = "Браузер не разрешает сохранение.";
  }
};
render();
