import * as THREE from "three";
import { domainMaterial } from "./domain-materials.js";
// Closed, two-sided petal volume, with a rolled edge and a non-planar midrib.
export function petalGeometry(
  length,
  width,
  cup = 0.3,
  ruffle = 0,
  phase = 0,
  shape = "pointed",
) {
  const U = shape === "fan" ? 24 : 16,
    V = shape === "fan" ? 32 : 12,
    vertices = [],
    indices = [],
    uvs = [];
  for (let side = 0; side < 2; side++)
    for (let i = 0; i <= U; i++)
      for (let j = 0; j <= V; j++) {
        const t = i / U,
          v = (j / V) * 2 - 1,
          edge =
            shape === "fan"
              ? Math.pow(Math.sin(Math.PI * t * 0.78), 0.6)
              : Math.pow(Math.sin(Math.PI * t), 0.6);
        const lobes =
          shape === "ivy" ? 0.64 + 0.36 * Math.cos(t * Math.PI * 6) : 1;
        const x =
          v *
          width *
          0.5 *
          edge *
          lobes *
          (1 + ruffle * Math.sin(v * 12 + t * 5 + phase) * t * t);
        const y =
          cup * t * t +
          v * v * 0.12 * length +
          Math.sin(v * 18 + phase) * ruffle * t * t * t * width * 0.12 +
          side * 0.024;
        vertices.push(
          x,
          y,
          t *
            length *
            (shape === "fan"
              ? 1 - 0.18 * v * v - 0.06 * Math.exp((-v * v) / 0.06)
              : 1),
        );
        uvs.push(j / V, t);
        if (i < U && j < V) {
          const k = side * (U + 1) * (V + 1) + i * (V + 1) + j;
          side
            ? indices.push(k, k + V + 1, k + 1, k + 1, k + V + 1, k + V + 2)
            : indices.push(k, k + 1, k + V + 1, k + 1, k + V + 2, k + V + 1);
        }
      }
  const offset = (U + 1) * (V + 1);
  for (let i = 0; i < U; i++)
    for (const j of [0, V]) {
      const a = i * (V + 1) + j,
        b = (i + 1) * (V + 1) + j;
      if (j === 0) indices.push(a, b, a + offset, b, b + offset, a + offset);
      else indices.push(a, a + offset, b, b, a + offset, b + offset);
    }
  for (let j = 0; j < V; j++)
    for (const i of [0, U]) {
      const a = i * (V + 1) + j,
        b = a + 1;
      if (i === 0) indices.push(a, a + offset, b, b, a + offset, b + offset);
      else indices.push(a, b, a + offset, b, b + offset, a + offset);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
export function botanicalLeaf(
  length = 3,
  width = 1.4,
  phase = 0,
  color = "#617745",
  shape = "pointed",
) {
  const group = new THREE.Group(),
    material = domainMaterial("leaf", { color });
  const mesh = new THREE.Mesh(
    petalGeometry(length, width, 0.2, 0.08, phase, shape),
    material,
  );
  mesh.castShadow = true;
  group.add(mesh);
  const points = Array.from(
    { length: 12 },
    (_, i) =>
      new THREE.Vector3(0, 0.2 * (i / 11) ** 2 + 0.026, (i / 11) * length),
  );
  const rib = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      20,
      0.018,
      6,
      false,
    ),
    domainMaterial("leaf", { color: "#91a06e" }),
  );
  group.add(rib);
  group.userData.component = "leaf-with-midrib";
  return group;
}
export function botanicalHead(plant, color = "#e5d9cd", seed = 1) {
  const group = new THREE.Group(),
    radius = plant.headDiameterCm / 2;
  const material = domainMaterial("petal", { color: "#ffffff" });
  material.vertexColors = true;
  const add = (
    length,
    width,
    cup,
    angle,
    y = 0,
    ruffle = 0.05,
    phase = 0,
    shape = plant.id === "carnation" ? "fan" : "pointed",
  ) => {
    const geometry = petalGeometry(length, width, cup, ruffle, phase, shape),
      uv = geometry.attributes.uv,
      colors = [],
      base = new THREE.Color(color);
    for (let i = 0; i < uv.count; i++) {
      const t = uv.getY(i),
        v = uv.getX(i),
        c = base
          .clone()
          .offsetHSL(
            Math.sin(phase + seed) * 0.007,
            (1 - t) * 0.06,
            (t - 0.45) * 0.055 + Math.sin(v * 20 + t * 12 + phase) * 0.012,
          );
      colors.push(c.r, c.g, c.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const n = new THREE.Mesh(geometry, material);
    n.rotation.y = angle;
    n.position.y = y;
    n.castShadow = true;
    group.add(n);
    return n;
  };
  const center = (r, y, tone) => {
    const n = new THREE.Mesh(
      new THREE.SphereGeometry(r, 24, 16),
      domainMaterial("nut", { color: tone }),
    );
    n.scale.y = 0.55;
    n.position.y = y;
    n.castShadow = true;
    group.add(n);
  };
  if (plant.id === "hydrangea" || plant.id === "lilac") {
    const n = plant.id === "hydrangea" ? 48 : 30;
    for (let i = 0; i < n; i++) {
      const a = i * 2.399963,
        rr = Math.sqrt(i / n) * radius * 0.82,
        x = Math.cos(a) * rr,
        z = Math.sin(a) * rr,
        y = Math.sqrt(Math.max(0, radius * radius - rr * rr)) * 0.55;
      for (let k = 0; k < 4; k++) {
        const p = add(
          plant.id === "hydrangea" ? 0.85 : 0.38,
          plant.id === "hydrangea" ? 1.1 : 0.45,
          0.12,
          (k * Math.PI) / 2,
          y,
          0.07,
          i,
        );
        p.position.x = x;
        p.position.z = z;
      }
    }
  } else if (plant.id === "dahlia" || plant.id === "carnation") {
    const rows = plant.id === "dahlia" ? 6 : 5;
    for (let row = 0; row < rows; row++) {
      const n = 24 - row * 3;
      for (let k = 0; k < n; k++) {
        const fraction = 1 - row / (rows + 1),
          p = add(
            radius * fraction,
            radius * (plant.id === "dahlia" ? 0.32 : 0.6) * fraction,
            radius * 0.18 + row * 0.11,
            (k / n) * Math.PI * 2 + row * 0.18,
            row * 0.16,
            plant.id === "carnation" ? 0.35 : 0.06,
            k * 0.7 + seed,
          );
        p.rotation.z = Math.sin(k * 1.7 + seed) * 0.07;
      }
    }
    center(radius * 0.12, 0.9, color);
  } else if (plant.id === "sweet-pea") {
    const standard = add(
      radius * 1.15,
      radius * 1.8,
      radius * 0.65,
      0,
      0.1,
      0.28,
      seed,
      "fan",
    );
    standard.rotation.x = -0.55;
    for (const sign of [-1, 1]) {
      const wing = add(radius, radius * 0.8, 0.5, sign * 1.2, 0, 0.2, sign);
      wing.rotation.z = sign * 0.55;
    }
    for (const sign of [-1, 1]) {
      const keel = add(
        radius * 0.72,
        radius * 0.5,
        radius * 0.65,
        Math.PI + sign * 0.18,
        0.1,
        0.08,
        seed,
      );
      keel.rotation.z = sign * 0.2;
    }
  } else {
    const count =
      plant.id === "hellebore" ? 5 : plant.id === "astrantia" ? 18 : 6;
    for (let k = 0; k < count; k++)
      add(
        radius,
        plant.id === "astrantia" ? radius * 0.3 : radius * 1.1,
        radius * 0.2,
        (k / count) * Math.PI * 2,
        0,
        0.1,
        k + seed,
      );
    center(
      radius * (plant.id === "astrantia" ? 0.32 : 0.14),
      0.2,
      plant.id === "astrantia" ? "#9ca777" : "#c6b568",
    );
    const florets = plant.id === "astrantia" ? 38 : 18;
    for (let k = 0; k < florets; k++) {
      const a = k * 2.399963,
        rr =
          plant.id === "astrantia"
            ? Math.sqrt(k / florets) * radius * 0.32
            : radius * 0.2,
        n = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 8, 6),
          domainMaterial("petal", {
            color: plant.id === "astrantia" ? "#eee9d8" : "#d6c77e",
          }),
        );
      n.position.set(
        Math.cos(a) * rr,
        plant.id === "astrantia"
          ? 0.27 + Math.sqrt(Math.max(0, (radius * 0.32) ** 2 - rr ** 2)) * 0.55
          : 0.25 + Math.sin(k) * 0.05,
        Math.sin(a) * rr,
      );
      group.add(n);
    }
  }
  group.userData.component = plant.id + "-head";
  return group;
}
export function botanicalBranch(plant, length = 16, seed = 1) {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.4, length * 0.5, 0.2),
    new THREE.Vector3(1, length, 0.5),
  ]);
  const stem = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 32, 0.045, 8, false),
    domainMaterial("stem"),
  );
  g.add(stem);
  const count = plant.role === "filler" ? 2 : plant.id === "fern" ? 18 : 9;
  for (let i = 0; i < count; i++) {
    const t = 0.25 + (i / count) * 0.7,
      point = curve.getPoint(t),
      side = i % 2 ? -1 : 1;
    const leaf = botanicalLeaf(
      plant.role === "filler"
        ? 1.1
        : plant.id === "fern"
          ? 2.4
          : plant.id === "ivy"
            ? 3
            : 2.8,
      plant.id === "eucalyptus" ? 2.1 : plant.id === "ruscus" ? 0.9 : 1.6,
      seed + i,
      plant.id === "eucalyptus" ? "#859a89" : "#607a49",
      plant.id === "ivy" ? "ivy" : "pointed",
    );
    leaf.position.copy(point);
    leaf.rotation.set(0.35, (side * Math.PI) / 2 + i * 0.16, side * 0.2);
    g.add(leaf);
  }
  if (plant.role === "filler")
    for (let i = 0; i < (plant.id === "astrantia" ? 9 : 18); i++) {
      const a = i * 2.399,
        point = new THREE.Vector3(
          Math.cos(a) * 3,
          length * 0.6 + (i / 18) * length * 0.45,
          Math.sin(a) * 3,
        );
      const line = new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([curve.getPoint(0.55), point]),
          10,
          0.022,
          6,
        ),
        domainMaterial("stem"),
      );
      g.add(line);
      const head = botanicalHead(
        {
          ...plant,
          headDiameterCm:
            plant.id === "limonium"
              ? 0.7
              : plant.id === "astrantia"
                ? plant.headDiameterCm
                : 0.55,
        },
        plant.id === "limonium" ? "#b59abd" : "#f0eee2",
        i,
      );
      head.position.copy(point);
      head.rotation.set(Math.sin(i * 1.7) * 0.16, i * 0.7, Math.cos(i) * 0.12);
      g.add(head);
    }
  g.userData.component = plant.id + "-branch";
  return g;
}
