const $ = (s) => document.querySelector(s);
let selectedPattern = $(".studio-section")?.dataset.initialPattern;
const applyPattern = () => {
  const api = window.studioReview;
  if (api?.ready() && selectedPattern)
    api.setState({ version: 2, pattern: selectedPattern, bouquetSize: 19 });
};
const selectPattern = (pattern) => {
  selectedPattern = pattern;
  applyPattern();
};
document.querySelectorAll("[data-choice]").forEach((button, i) => {
  button.setAttribute("aria-pressed", String(i === 0));
  button.addEventListener("click", () => {
    document
      .querySelectorAll("[data-choice]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    selectPattern(button.dataset.pattern);
    const preview = $(".selection-image");
    if (preview && button.dataset.preview) {
      preview.src = button.dataset.preview;
      preview.alt = button.dataset.title;
    }
    if ($("[data-selection-title]"))
      $("[data-selection-title]").textContent = button.dataset.title;
    if ($("[data-selection-description]"))
      $("[data-selection-description]").textContent =
        button.dataset.description;
    if ($("[data-letter-preview]"))
      $("[data-letter-preview]").textContent = button.dataset.title + ".";
  });
});
document
  .querySelectorAll("[data-set-pattern]")
  .forEach((a) =>
    a.addEventListener("click", () => selectPattern(a.dataset.setPattern)),
  );
if (document.body.dataset.brand !== "fashion") {
  let attempts = 0;
  const wait = () => {
    if (window.studioReview?.ready()) {
      applyPattern();
      return;
    }
    if (++attempts < 180) setTimeout(wait, 500);
  };
  wait();
}
document.querySelectorAll("[data-draft]").forEach((form) => {
  const key = "portfolio-concept-" + form.dataset.draft;
  try {
    const data = JSON.parse(localStorage.getItem(key) || "null");
    if (data)
      for (const [name, value] of Object.entries(data))
        if (form.elements[name]) form.elements[name].value = value;
  } catch {}
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      localStorage.setItem(
        key,
        JSON.stringify(Object.fromEntries(new FormData(form))),
      );
      form.querySelector("output").textContent =
        "Заметка сохранена в этом браузере.";
    } catch {
      form.querySelector("output").textContent =
        "Браузер не разрешает сохранить заметку.";
    }
  });
});
const letter = $("[data-letter]");
if (letter) {
  try {
    letter.value = localStorage.getItem("portfolio-concept-letter") || "";
  } catch {}
  const update = () => {
    if (letter.value) $("[data-letter-preview]").textContent = letter.value;
    try {
      localStorage.setItem("portfolio-concept-letter", letter.value);
    } catch {}
  };
  letter.addEventListener("input", update);
  update();
}
const memory = () => {
  const title = $("[data-memory-heading]"),
    text = $("[data-memory-text]");
  if (title) $("[data-memory-title]").textContent = title.value || "Для себя.";
  if (text)
    $("[data-memory-preview]").textContent =
      text.value || "Напишите, что хочется запомнить.";
};
$("[data-memory-heading]")?.addEventListener("input", memory);
$("[data-memory-text]")?.addEventListener("input", memory);
memory();
document.querySelectorAll("[data-rhythm]").forEach((button) =>
  button.addEventListener("click", () => {
    document
      .querySelectorAll("[data-rhythm]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    $("[data-rhythm-output]").textContent =
      button.dataset.rhythm + " — новая композиция для вашего пространства.";
  }),
);
const outfits = {
  work: [
    ["shirt.jpg", "Рубашка", "Чёткая основа"],
    ["denim.jpg", "Джинсы", "Свобода движения"],
    ["knit.jpg", "Трикотаж", "Мягкий слой"],
  ],
  weekend: [
    ["knit.jpg", "Трикотаж", "Мягкий первый слой"],
    ["denim.jpg", "Деним", "Двигайтесь свободно"],
    ["bag.jpg", "Сумка", "Всё необходимое"],
  ],
  travel: [
    ["blouse.jpg", "Блузка", "Лёгкая основа"],
    ["denim.jpg", "Джинсы", "Один низ для разных дней"],
    ["knit.jpg", "Трикотаж", "Дополнительный слой"],
  ],
};
document.querySelectorAll("[data-outfit]").forEach((button) =>
  button.addEventListener("click", () => {
    document
      .querySelectorAll("[data-outfit]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    outfits[button.dataset.outfit].forEach(([file, title, note], i) => {
      $(".outfit-image-" + i).src = "assets/img/" + file;
      $(".outfit-image-" + i).alt = title;
      $(".outfit-title-" + i).textContent = title;
      $(".outfit-note-" + i).textContent = note;
    });
    $("[data-outfit-output]").textContent =
      button.textContent + " / три вещи, которые работают вместе.";
  }),
);
if ($("[data-live-products]")) {
  let category = "all";
  const products = window.LINIA_DATA?.products || [];
  const safe = (s) =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  const update = () => {
    const query = $("[data-product-search]").value.toLocaleLowerCase("ru");
    let rows = products.filter(
      (p) =>
        (category === "all" || p.cat === category) &&
        p.name.toLocaleLowerCase("ru").includes(query),
    );
    const sort = $("[data-product-sort]").value;
    if (sort !== "default")
      rows = [...rows].sort((a, b) =>
        sort === "price-up" ? a.price - b.price : b.price - a.price,
      );
    $("[data-result-count]").textContent = rows.length;
    $("[data-empty]").hidden = rows.length > 0;
    $("[data-live-products]").innerHTML = rows
      .map(
        (p) =>
          `<a class="live-product" href="catalog.html"><img src="assets/img/looks/${safe(p.id)}.svg" alt="Эскиз: ${safe(p.name)}" loading="lazy"><h3>${safe(p.name)}</h3><small>Эскиз силуэта / ${safe(p.cat)}</small><p>${p.price} BYN</p></a>`,
      )
      .join("");
  };
  $("[data-product-search]").addEventListener("input", update);
  $("[data-product-sort]").addEventListener("change", update);
  document.querySelectorAll("[data-category]").forEach((button) =>
    button.addEventListener("click", () => {
      category = button.dataset.category;
      document
        .querySelectorAll("[data-category]")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      update();
    }),
  );
  update();
}
