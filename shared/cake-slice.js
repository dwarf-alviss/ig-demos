import * as THREE from "three";
import { physical } from "./model-library.js";
function crumb(color, seed = 1) {
  const w = 128,
    data = new Uint8Array(w * w * 4),
    c = new THREE.Color(color);
  for (let i = 0; i < w * w; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const k = 0.7 + (seed / 4294967296) * 0.3;
    data[i * 4] = THREE.MathUtils.clamp(c.r ** (1 / 2.2) * 255 * k, 0, 255);
    data[i * 4 + 1] = c.g ** (1 / 2.2) * 255 * k;
    data[i * 4 + 2] = c.b ** (1 / 2.2) * 255 * k;
    data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, w, w);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.needsUpdate = true;
  return t;
}
export function cakeSlice(filling, icing) {
  const root = new THREE.Group(),
    shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(7, 0);
  shape.absarc(0, 0, 7, 0, Math.PI / 3, false);
  shape.lineTo(0, 0);
  const tones = {
    vanilla: ["#dfbe80", "#f4e5c8"],
    berry: ["#dfbe80", "#bd476a"],
    chocolate: ["#805334", "#4d2c25"],
    pistachio: ["#b9bf83", "#c7475d"],
  }[filling];
  let y = 0;
  for (let i = 0; i < 7; i++) {
    const biscuit = i % 2 === 0,
      h = biscuit ? 1.25 : 0.68;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: h,
      bevelEnabled: false,
      curveSegments: 36,
    });
    geo.rotateX(-Math.PI / 2);
    const m = physical(tones[biscuit ? 0 : 1]);
    m.map = crumb(tones[biscuit ? 0 : 1], i + 1);
    m.color.set("#ffffff");
    m.roughness = biscuit ? 0.92 : 0.54;
    const layer = new THREE.Mesh(geo, m);
    layer.position.y = y;
    layer.castShadow = true;
    layer.receiveShadow = true;
    root.add(layer);
    y += h;
  }
  const cap = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.26,
      bevelEnabled: false,
      curveSegments: 36,
    }),
    physical(icing),
  );
  cap.geometry.rotateX(-Math.PI / 2);
  cap.position.y = y;
  cap.castShadow = true;
  root.add(cap);
  // Coat only the curved back; the two radial faces expose the filling.
  const side = new THREE.Mesh(
    new THREE.CylinderGeometry(
      7.03,
      7.03,
      y + 0.25,
      48,
      1,
      true,
      Math.PI / 2,
      Math.PI / 3,
    ),
    physical(icing),
  );
  side.position.y = (y + 0.25) / 2;
  root.add(side);
  // Face both radial cuts toward the default front and side cameras.
  // The iced curved back remains behind the visible crumb layers.
  root.rotation.y = Math.PI * 0.55;
  root.userData.component = "filling-slice";
  return root;
}
