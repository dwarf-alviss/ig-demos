import { themes, price, sanitize } from "./config.js";
export function cartLine(kind, value, img) {
  const theme = themes[kind],
    state = sanitize(theme, value);
  const id =
    "studio-" +
    kind +
    "-" +
    [state.base, state.detail, state.extra, state.color, state.quantity].join(
      "-",
    );
  const summary = [
    theme.base[state.base][1],
    theme.detail[state.detail][1],
    theme.extra[state.extra][1],
    theme.colors[state.color][0],
    `${state.quantity} ${kind === "cakes" ? "ярус(а)" : kind === "flowers" ? "цветов" : "мм"}`,
  ].join(" · ");
  const title = `${kind === "cakes" ? "Торт" : kind === "flowers" ? "Букет" : "Украшение"} из студии ${theme.brand}`;
  const base = {
    id,
    qty: 1,
    price: price(theme, state),
    img: img || theme.image,
    note: summary,
    configuration: state,
  };
  if (kind === "flowers") return { ...base, name: title };
  if (kind === "cakes") return { ...base, title, meta: summary };
  return {
    ...base,
    title,
    key: id + "|" + theme.colors[state.color][0] + "|",
    material: theme.colors[state.color][0],
    engraving: "",
    alt: summary,
  };
}
export function mergeCart(items, line) {
  const list = Array.isArray(items)
    ? items.filter((x) => x && typeof x === "object")
    : [];
  const same = list.find((x) => x.id === line.id);
  if (same) {
    same.qty = Math.min(99, (Number(same.qty) || 0) + 1);
  } else list.push(line);
  return list;
}
export async function saveShot(kind, canvas) {
  if (!canvas || canvas.hidden || !globalThis.indexedDB) return null;
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.8),
  );
  if (!blob) return null;
  return new Promise((resolve) => {
    const request = indexedDB.open(`igdemo_${kind}_photos_v1`, 1);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("shots"))
        request.result.createObjectStore("shots");
    };
    request.onsuccess = () => {
      const db = request.result,
        key = "studio-" + crypto.randomUUID();
      const tx = db.transaction("shots", "readwrite");
      tx.objectStore("shots").put(blob, key);
      tx.oncomplete = () => {
        db.close();
        resolve("idb:" + key);
      };
      tx.onerror = () => {
        db.close();
        resolve(null);
      };
    };
  });
}
