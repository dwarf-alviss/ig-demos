import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { themes, price, sanitize } from "./config.js";
import { disposeTree, fitToScene } from "./scene-utils.js";
import { cartLine, mergeCart, saveShot } from "./cart.js";
const kind = document.body.dataset.studio,
  theme = themes[kind],
  $ = (s) => document.querySelector(s);
const key = `portfolio-studio-${kind}-v1`;
let stored = {};
try {
  stored = JSON.parse(localStorage.getItem(key) || "{}");
} catch {}
let state = sanitize(theme, stored),
  revision = 0,
  active = null,
  renderer,
  scene,
  camera,
  controls,
  environment,
  frame,
  observer;
const templates = new Map(),
  pending = new Map(),
  history = [];
let rotating = false;
const status = $("#status");
function persist() {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    status.textContent = "Сохранение в браузере недоступно";
  }
}
function setState(next) {
  history.push({ ...state });
  state = sanitize(theme, next);
  persist();
  updateUI();
  assemble();
}
function choice(key, list) {
  return `<fieldset><legend>${{ base: kind === "flowers" ? "01 / Цветок" : "01 / Форма", detail: kind === "flowers" ? "02 / Упаковка" : kind === "cakes" ? "02 / Декор" : "02 / Камень", extra: "03 / Последний штрих", color: kind === "jewelry" ? "04 / Металл" : "04 / Палитра" }[key]}</legend><div class="choices ${key === "color" ? "swatches" : ""}">${list.map((item, i) => `<button type="button" data-key="${key}" data-value="${i}" aria-pressed="false">${key === "color" ? `<span style="--swatch:${item[1]}"></span>` : ""}${item[key === "color" ? 0 : 1]}</button>`).join("")}</div></fieldset>`;
}
$("#options").innerHTML =
  choice("base", theme.base) +
  choice("detail", theme.detail) +
  choice("extra", theme.extra) +
  choice("color", theme.colors) +
  `<fieldset><legend>${theme.quantityLabel}</legend><div class="choices">${theme.quantity.map((q) => `<button type="button" data-key="quantity" data-value="${q}" aria-pressed="false">${q}</button>`).join("")}</div></fieldset>`;
$("#presets").innerHTML = theme.presets
  .map(
    (p, i) =>
      `<button data-preset="${i}"><span>0${i + 1}</span>${p[0]}<b>↗</b></button>`,
  )
  .join("");
$("#options").addEventListener("click", (e) => {
  const b = e.target.closest("[data-key]");
  if (b) setState({ ...state, [b.dataset.key]: Number(b.dataset.value) });
});
$("#presets").addEventListener("click", (e) => {
  const b = e.target.closest("[data-preset]");
  if (!b) return;
  const p = theme.presets[Number(b.dataset.preset)];
  setState({ base: p[1], detail: p[2], color: p[3], quantity: p[4], extra: 0 });
});
function updateUI() {
  document
    .querySelectorAll("[data-key]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(state[b.dataset.key] === Number(b.dataset.value)),
      ),
    );
  $("#price").textContent =
    price(theme, state).toLocaleString("ru-RU") + " BYN";
  $("#summary").textContent = [
    theme.base[state.base][1],
    theme.detail[state.detail][1],
    theme.colors[state.color][0],
    kind === "jewelry"
      ? `Размер ${state.quantity}`
      : `${state.quantity} ${kind === "cakes" ? "ярус(а)" : "цветов"}`,
  ].join(" · ");
  $("#undo").disabled = !history.length;
}
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function template(id) {
  if (templates.has(id)) return templates.get(id);
  if (!pending.has(id))
    pending.set(
      id,
      loader
        .loadAsync(new URL(`models/${id}.glb`, import.meta.url).href)
        .then((g) => {
          templates.set(id, g.scene);
          pending.delete(id);
          return g.scene;
        })
        .catch((e) => {
          pending.delete(id);
          throw e;
        }),
    );
  return pending.get(id);
}
function material(color, type = "soft") {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: type === "metal" ? 0.2 : type === "gem" ? 0.06 : 0.58,
    metalness: type === "metal" ? 1 : 0,
    transmission: type === "gem" ? 0.72 : 0,
    ior: type === "gem" ? 2.4 : 1.5,
    thickness: 0.4,
    clearcoat: type === "soft" ? 0.15 : 0.8,
    side: THREE.DoubleSide,
  });
}
async function part(id, size, color, type = "soft", axis = "x") {
  const original = await template(id);
  const copy = original.clone(true);
  copy.traverse((n) => {
    if (n.isMesh) {
      n.geometry = n.geometry.clone();
      n.material = material(color, type);
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
  return fitToScene(copy, size, axis);
}
async function assemble() {
  if (!renderer) return;
  const ticket = ++revision,
    s = { ...state },
    next = new THREE.Group(),
    color = theme.colors[s.color][1];
  status.textContent = "Собираем вашу композицию…";
  $("#viewer").setAttribute("aria-busy", "true");
  $("#add-cart").disabled = true;
  try {
    if (kind === "cakes") {
      let y = 0;
      for (let i = 0; i < s.quantity; i++) {
        const tier = await part(theme.base[s.base][0], 24 - i * 5, color);
        const tierHeight = new THREE.Box3()
          .setFromObject(tier)
          .getSize(new THREE.Vector3()).y;
        tier.scale.y *= 8 / tierHeight;
        tier.position.y = y;
        next.add(tier);
        const box = new THREE.Box3().setFromObject(tier);
        y = box.max.y;
      }
      for (let i = 0; i < 7; i++) {
        const d = await part(
          theme.detail[s.detail][0],
          3.4,
          s.detail < 3
            ? ["#c84353", "#55568f", "#bd344f"][s.detail]
            : s.detail === 5
              ? "#4b2b20"
              : color,
        );
        const a = (i / 7) * Math.PI * 2;
        d.position.set(
          Math.cos(a) * (8 - s.quantity),
          y,
          Math.sin(a) * (8 - s.quantity),
        );
        d.rotation.y = a;
        next.add(d);
      }
      if (s.extra) {
        const d = await part(theme.extra[s.extra][0], 5, "#d5ae63", "metal");
        d.position.y = y + 1;
        next.add(d);
      }
    } else if (kind === "flowers") {
      const wrap = await part(theme.detail[s.detail][0], 20, "#bba17b");
      if (s.detail === 0) wrap.scale.y *= 0.65;
      wrap.updateMatrixWorld(true);
      next.add(wrap);
      const top = new THREE.Box3().setFromObject(wrap).max.y;
      for (let i = 0; i < s.quantity; i++) {
        const angle = i * 2.399963,
          r = Math.sqrt(i) * 3.25;
        const flower = await part(theme.base[s.base][0], 10, color);
        flower.position.set(
          Math.cos(angle) * r,
          top - 1 + Math.sin(i) * 1.2,
          Math.sin(angle) * r,
        );
        flower.rotation.set(
          0.12 * Math.cos(angle),
          angle,
          0.12 * Math.sin(angle),
        );
        next.add(flower);
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.14, top, 6),
          material("#657a45"),
        );
        stem.position.set(
          Math.cos(angle) * r * 0.5,
          top * 0.5,
          Math.sin(angle) * r * 0.5,
        );
        next.add(stem);
      }
      if (s.extra)
        for (let i = 0; i < 3; i++) {
          const green = await part(
            theme.extra[s.extra][0],
            12,
            s.extra === 2 ? "#eee9d8" : "#758a66",
          );
          const a = (i / 3) * Math.PI * 2;
          green.position.set(Math.cos(a) * 7, top * 0.65, Math.sin(a) * 7);
          green.rotation.y = a;
          next.add(green);
        }
    } else {
      const base = await part(
        theme.base[s.base][0],
        s.base === 4 ? 6 : s.base === 2 ? 2.4 : s.quantity / 10,
        color,
        "metal",
      );
      next.add(base);
      const bb = new THREE.Box3().setFromObject(base);
      const stone = await part(
        theme.detail[s.detail][0],
        s.base === 4 ? 0.9 : 0.65,
        s.detail === 0 ? "#f3f5ff" : "#579c9c",
        "gem",
      );
      stone.position.set(0, bb.max.y - 0.45, 0);
      next.add(stone);
      if (s.extra) {
        const setting = await part(
          theme.extra[s.extra][0],
          0.9,
          color,
          "metal",
        );
        setting.position.y = bb.max.y - 0.3;
        next.add(setting);
      }
    }
    if (ticket !== revision) {
      disposeTree(next);
      return;
    }
    if (active) {
      scene.remove(active);
      disposeTree(active);
    }
    active = next;
    scene.add(active);
    frameCamera();
    $("#fallback").hidden = true;
    $("#canvas").hidden = false;
    status.textContent = "Композиция готова · потяните для вращения";
    $("#viewer").dataset.ready = "true";
  } catch (e) {
    disposeTree(next);
    if (ticket !== revision) return;
    status.textContent = "Не удалось загрузить модель. Попробуйте ещё раз.";
    $("#retry").hidden = false;
    console.error(e);
  } finally {
    if (ticket === revision) {
      $("#viewer").setAttribute("aria-busy", "false");
      $("#add-cart").disabled = false;
    }
  }
}
function frameCamera() {
  if (!active) return;
  const b = new THREE.Box3().setFromObject(active),
    size = b.getSize(new THREE.Vector3()),
    center = b.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z),
    distance =
      (r / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) * 1.12;
  controls.target.copy(center);
  camera.position
    .copy(center)
    .add(new THREE.Vector3(distance * 0.6, distance * 0.48, distance));
  camera.near = Math.max(0.01, r / 1000);
  camera.far = distance * 20;
  camera.updateProjectionMatrix();
  controls.minDistance = r * 0.65;
  controls.maxDistance = distance * 3;
  controls.update();
}
function init() {
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: $("#canvas"),
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.75;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
    const room = new RoomEnvironment(),
      pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8c8073, 0.75));
    const light = new THREE.DirectionalLight(0xfff2db, 1.8);
    light.position.set(15, 25, 20);
    scene.add(light);
    controls = new OrbitControls(camera, $("#canvas"));
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.listenToKeyEvents($("#canvas"));
    observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    observer.observe($("#viewer"));
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (document.hidden) return;
      controls.autoRotate =
        rotating && !matchMedia("(prefers-reduced-motion: reduce)").matches;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    assemble();
  } catch (e) {
    status.textContent =
      "3D недоступно на этом устройстве. Конфигурация и расчёт работают по фото.";
    $("#canvas").hidden = true;
    document
      .querySelectorAll("[data-camera]")
      .forEach((b) => (b.disabled = true));
  }
}
$("#undo").onclick = () => {
  if (history.length) {
    state = history.pop();
    persist();
    updateUI();
    assemble();
  }
};
$("#reset").onclick = () => setState({});
$("#retry").onclick = () => {
  $("#retry").hidden = true;
  assemble();
};
$("#camera-home").onclick = frameCamera;
$("#rotate").onclick = () => {
  rotating = !rotating;
  $("#rotate").setAttribute("aria-pressed", String(rotating));
};
$("#download").onclick = () => {
  const data = {
    project: kind,
    configuration: state,
    description: $("#summary").textContent,
    estimateBYN: price(theme, state),
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${kind}-design.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = "Конфигурация скачана";
};
$("#add-cart").onclick = async () => {
  const selected = { ...state };
  const b = $("#add-cart");
  b.disabled = true;
  try {
    const cartKey = `igdemo_${kind}_cart_v1`;
    const existing = JSON.parse(localStorage.getItem(cartKey) || "[]");
    const draft = cartLine(kind, selected);
    const same =
      Array.isArray(existing) && existing.find((x) => x?.id === draft.id);
    const image = same?.img || (await saveShot(kind, $("#canvas")));
    const line = cartLine(kind, selected, image);
    const latest = JSON.parse(localStorage.getItem(cartKey) || "[]");
    localStorage.setItem(cartKey, JSON.stringify(mergeCart(latest, line)));
    status.textContent = "Дизайн добавлен в корзину";
    $("#cart-link").hidden = false;
  } catch {
    status.textContent = "Не удалось сохранить корзину. Скачайте конфигурацию.";
  } finally {
    b.disabled = false;
  }
};
$("#save").onclick = () => {
  persist();
  status.textContent = "Ваш дизайн сохранён в этом браузере";
};
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  ++revision;
  cancelAnimationFrame(frame);
  observer?.disconnect();
  controls?.dispose();
  if (active) disposeTree(active);
  templates.forEach(disposeTree);
  templates.clear();
  environment?.dispose();
  renderer?.dispose();
});
updateUI();
init();
