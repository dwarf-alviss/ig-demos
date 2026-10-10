import { themes, price, sanitize } from "./config.js";
import { normalize, estimate, describe, projectSpecs } from "./studio-state.js";
export function cartLine(kind, value, img) {
  if (value?.version === 2) {
    const state = normalize(kind, value),
      text = JSON.stringify(state);
    let hash = 2166136261;
    for (const c of text) {
      hash ^= c.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    const id = "studio-v2-" + kind + "-" + (hash >>> 0).toString(16),
      title =
        (kind === "cakes"
          ? "Торт"
          : kind === "flowers"
            ? "Букет"
            : "Украшение") +
        " из студии " +
        projectSpecs[kind].brand;
    const summary = describe(kind, state),
      line = {
        id,
        qty: 1,
        price: estimate(kind, state),
        img: img || themes[kind].image,
        note: summary,
        configuration: state,
      };
    return kind === "flowers"
      ? { ...line, name: title }
      : kind === "cakes"
        ? { ...line, title, meta: summary }
        : {
            ...line,
            title,
            key: id + "|" + projectSpecs[kind].palette[state.palette][0] + "|",
            material: projectSpecs[kind].palette[state.palette][0],
            engraving: "",
            alt: summary,
          };
  }
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
    same.qty = Math.min(99, (Number(same.qty) || 0) + (Number(line.qty) || 1));
  } else list.push(line);
  return list;
}
export function replaceCartDesign(items, line, id) {
  const list = Array.isArray(items) ? items : [],
    old = list.find((x) => x?.id === id);
  return mergeCart(
    list.filter((x) => x?.id !== id),
    { ...line, qty: old?.qty || 1 },
  );
}
export async function saveShot(kind, canvas, background = "#f5eee5") {
  if (!canvas || canvas.hidden || !globalThis.indexedDB) return null;
  const shot = document.createElement("canvas");
  shot.width = Math.min(720, canvas.width);
  shot.height = Math.round((canvas.height * shot.width) / canvas.width);
  const ctx = shot.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, shot.width, shot.height);
  ctx.drawImage(canvas, 0, 0, shot.width, shot.height);
  const blob = await new Promise((resolve) =>
    shot.toBlob(resolve, "image/jpeg", 0.85),
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
