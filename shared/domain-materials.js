import * as THREE from "three";
import { materialProfiles } from "./domain.js";
// Deterministic, locally generated microstructure. No photographed reference is used as a texture.
function microtexture(id, finish) {
  const width = 128,
    data = new Uint8Array(width * width * 4);
  let seed =
    Array.from(id).reduce((n, c) => Math.imul(n, 31) + c.charCodeAt(0), 97) >>>
    0;
  for (let y = 0; y < width; y++)
    for (let x = 0; x < width; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 4294967296;
      const groove =
        finish === "brushed"
          ? Math.sin(y * 2.2) * 0.22
          : finish === "hammered"
            ? Math.sin(x * 0.4) * Math.cos(y * 0.4) * 0.3
            : 0;
      const value = Math.round(170 + noise * 70 + groove * 50),
        i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
  const texture = new THREE.DataTexture(data, width, width);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.needsUpdate = true;
  return texture;
}
export function domainMaterial(id, options = {}) {
  const p = materialProfiles[id];
  if (!p) throw new Error(`Missing physical material ${id}`);
  const metal = p.metalness === 1,
    gem = p.ior && !metal && id !== "glass";
  const finish = options.finish || "polished";
  const roughness = metal
    ? ({ polished: 0.13, satin: 0.38, brushed: 0.29, hammered: 0.24 }[finish] ??
      p.roughness)
    : p.roughness;
  const m = new THREE.MeshPhysicalMaterial({
    color: options.color || p.color,
    roughness,
    metalness: p.metalness || 0,
    ior: p.ior || 1.5,
    transmission: p.transmission || 0,
    thickness: gem ? 0.35 : id === "glass" ? 0.12 : 0.025,
    attenuationDistance: gem ? 3 : Infinity,
    attenuationColor: gem ? options.color || p.color : "#ffffff",
    clearcoat: /glaze|mirror|caramel/.test(id) ? 0.4 : 0,
    clearcoatRoughness: 0.16,
    specularIntensity: metal ? 1 : 0.8,
    envMapIntensity: metal ? 1.3 : 1,
    side: THREE.DoubleSide,
  });
  if (!gem && id !== "glass") {
    const texture = microtexture(id, finish);
    m.bumpMap = texture;
    m.bumpScale = metal
      ? finish === "polished"
        ? 0.0002
        : 0.0015
      : /sponge|biscuit|sable/.test(id)
        ? 0.035
        : id === "leaf"
          ? 0.009
          : 0.003;
    m.roughnessMap = texture;
    if (/sponge|joconde|sable|velvet|choux/.test(id)) {
      const width = 256,
        data = new Uint8Array(width * width * 4),
        base = new THREE.Color(options.color || p.color);
      let seed = 71;
      for (let i = 0; i < width * width; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const v = seed / 4294967296,
          k = v < 0.09 ? 0.51 : v < 0.24 ? 0.8 : 1 + v * 0.1;
        data[i * 4] = Math.min(255, Math.pow(base.r, 1 / 2.2) * 255 * k);
        data[i * 4 + 1] = Math.min(255, Math.pow(base.g, 1 / 2.2) * 255 * k);
        data[i * 4 + 2] = Math.min(255, Math.pow(base.b, 1 / 2.2) * 255 * k);
        data[i * 4 + 3] = 255;
      }
      const crumb = new THREE.DataTexture(data, width, width);
      crumb.colorSpace = THREE.SRGBColorSpace;
      crumb.wrapS = crumb.wrapT = THREE.RepeatWrapping;
      crumb.needsUpdate = true;
      m.map = crumb;
      m.color.set("#ffffff");
      m.bumpMap = crumb;
      m.bumpScale = id === "velvet" ? 0.005 : 0.045;
    }
  }
  m.userData = {
    profile: id,
    finish,
    subsurface: p.subsurfaceApproximation || null,
  };
  return m;
}
