import * as THREE from "three";

function heartOutline(radius, slice) {
  const full = new THREE.Shape();
  full.moveTo(0, -radius * 0.8);
  full.bezierCurveTo(
    -radius * 1.6,
    radius * 0.05,
    -radius,
    radius * 1.35,
    0,
    radius * 0.6,
  );
  full.bezierCurveTo(
    radius,
    radius * 1.35,
    radius * 1.6,
    radius * 0.05,
    0,
    -radius * 0.8,
  );
  return splitOutline(full, slice);
}
function splitOutline(full, slice) {
  const polygon = full.getPoints(120),
    inside = (p) => p.x >= 0 && p.y >= 0 && p.y <= Math.tan(0.57) * p.x;
  if (slice) {
    let result = polygon;
    for (const f of [
      (p) => p.x,
      (p) => p.y,
      (p) => Math.tan(0.57) * p.x - p.y,
    ]) {
      const next = [];
      for (let i = 0; i < result.length; i++) {
        const a = result[i],
          b = result[(i + 1) % result.length],
          fa = f(a),
          fb = f(b);
        if (fa >= 0) next.push(a);
        if (fa >= 0 !== fb >= 0) next.push(a.clone().lerp(b, fa / (fa - fb)));
      }
      result = next;
    }
    return new THREE.Shape(result);
  }
  const result = [];
  for (let i = 0; i < polygon.length - 1; i++) {
    const a = polygon[i],
      b = polygon[i + 1],
      ai = inside(a),
      bi = inside(b);
    if (!ai) result.push(a);
    if (ai !== bi) {
      let lo = 0,
        hi = 1;
      for (let k = 0; k < 32; k++) {
        const mid = (lo + hi) / 2;
        if (inside(a.clone().lerp(b, mid)) === ai) lo = mid;
        else hi = mid;
      }
      result.push(a.clone().lerp(b, (lo + hi) / 2));
      if (!ai) result.push(new THREE.Vector2(0, 0));
    }
  }
  return new THREE.Shape(result);
}
export function outline(recipe, radius, slice = false) {
  if (recipe.shape === "heart") return heartOutline(radius, slice);
  if (recipe.shape === "hex") {
    const full = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      full[i ? "lineTo" : "moveTo"](Math.cos(a) * radius, Math.sin(a) * radius);
    }
    full.closePath();
    return splitOutline(full, slice);
  }
  const s = new THREE.Shape();
  if (slice) {
    if (recipe.shape === "rectangle") {
      s.moveTo(0, 0);
      s.lineTo(radius * 0.8, 0);
      s.lineTo(radius * 0.8, radius * 0.37);
      s.lineTo(0, radius * 0.37);
      s.closePath();
    } else {
      s.moveTo(0, 0);
      s.absarc(0, 0, radius, 0, 0.57, false);
      s.lineTo(0, 0);
    }
  } else if (recipe.shape === "rectangle") {
    const w = radius,
      h = radius * 0.67;
    s.moveTo(-w, -h);
    s.lineTo(w * 0.2, -h);
    s.lineTo(w * 0.2, -w * 0.3);
    s.lineTo(w, -w * 0.3);
    s.lineTo(w, h);
    s.lineTo(-w, h);
    s.closePath();
  } else {
    s.moveTo(0, 0);
    s.absarc(0, 0, radius, 0.57, Math.PI * 2, false);
    s.lineTo(0, 0);
  }
  return s;
}

const supportPolygons = new Map();
export function recipeFootprintSupported(recipe, radius, x, z, footprint) {
  const key = recipe.shape + ":" + radius;
  if (!supportPolygons.has(key))
    supportPolygons.set(
      key,
      outline(recipe, radius, false)
        .getPoints(144)
        .map((p) => ({ x: p.x, z: -p.y })),
    );
  const polygon = supportPolygons.get(key);
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.z > z !== b.z > z &&
      x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x
    )
      inside = !inside;
  }
  if (!inside) return false;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length],
      dx = b.x - a.x,
      dz = b.z - a.z;
    const len = dx * dx + dz * dz;
    const t = len
      ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len))
      : 0;
    if (Math.hypot(x - a.x - t * dx, z - a.z - t * dz) < footprint + 0.12)
      return false;
  }
  return true;
}
