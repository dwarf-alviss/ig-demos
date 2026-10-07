import * as THREE from "three";
import { designs, jewelParts } from "./domain.js";
import { domainMaterial } from "./domain-materials.js";
import { catalogue, byId } from "./catalogue.js";
import { stoneShape } from "./jewelry-rules.js";
import { bounds, place } from "./model-library.js";
import { convexHull } from "./fitted-cast.js";

const TAU = Math.PI * 2;
export function sweptBand(
  innerDiameter,
  width,
  thickness,
  profile = "round-court",
) {
  const vertices = [],
    indices = [],
    U = 160,
    V = 32,
    inner = innerDiameter / 2;
  for (let i = 0; i <= U; i++) {
    const a =
        profile === "bypass"
          ? Math.PI / 2 + 0.35 + (i / U) * (TAU - 0.7)
          : (i / U) * TAU,
      shoulder = Math.pow(Math.max(0, Math.sin(a)), 5);
    const taper = profile === "tapered-shoulder" ? 1 - shoulder * 0.4 : 1;
    for (let j = 0; j <= V; j++) {
      const t = (j / V) * TAU;
      const flat = profile === "rounded-flat" || profile === "comfort-fit";
      const exponent = flat ? 0.38 : profile === "knife-edge" ? 0.7 : 1;
      const radial =
        inner +
        thickness / 2 +
        (Math.sign(Math.cos(t)) *
          Math.pow(Math.abs(Math.cos(t)), exponent) *
          thickness) /
          2;
      const z =
        ((Math.sign(Math.sin(t)) *
          Math.pow(Math.abs(Math.sin(t)), flat ? 0.38 : 1) *
          width) /
          2) *
          taper +
        (profile === "bypass" ? Math.cos(a) * 0.17 : 0);
      vertices.push(Math.cos(a) * radial, Math.sin(a) * radial, z);
      if (i < U && j < V) {
        const k = i * (V + 1) + j;
        indices.push(k, k + V + 1, k + 1, k + 1, k + V + 1, k + V + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function wire(points, radius, material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, "centripetal");
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      Math.max(32, points.length * 12),
      radius,
      12,
      closed,
    ),
    material,
  );
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
function loop(rx, ry, r, material) {
  return wire(
    Array.from(
      { length: 32 },
      (_, i) =>
        new THREE.Vector3(
          Math.cos((i / 32) * TAU) * rx,
          Math.sin((i / 32) * TAU) * ry,
          0,
        ),
    ),
    r,
    material,
    true,
  );
}
function chooseStone(state, design, shape = null) {
  const cuts = shape ? [shape] : design.compatibleCuts;
  const matches = (id) =>
    cuts.some((c) =>
      c === "cabochon"
        ? stoneShape(id)?.includes("cabochon")
        : stoneShape(id) === c,
    );
  return matches(state.stone)
    ? state.stone
    : catalogue.find((a) => a.category === "stone" && matches(a.id))?.id;
}
async function setting(lib, id, diameter, type, metal, gemProfile = "diamond") {
  const group = new THREE.Group();
  const native = await lib.get(id, {
    size: diameter,
    axis: "x",
    role: "gem",
    rotation: (byId[id].face || "y") === "z" ? [-Math.PI / 2, 0, 0] : null,
  });
  const b = bounds(native),
    center = b.getCenter(new THREE.Vector3()),
    h = b.max.y - b.min.y;
  native.position.sub(center);
  native.updateMatrixWorld(true);
  const points = [],
    cloud = [];
  native.traverse((n) => {
    if (!n.isMesh) return;
    const old = n.material;
    n.material = domainMaterial(gemProfile, {
      color: byId[id].color || "#ffffff",
    });
    old?.dispose();
    const a = n.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const p = new THREE.Vector3()
        .fromBufferAttribute(a, i)
        .applyMatrix4(n.matrixWorld);
      points.push([p.x, p.z]);
      cloud.push(p);
    }
  });
  const hull = convexHull(points),
    outer = cloud.filter((p) =>
      hull.some(([x, z]) => Math.hypot(x - p.x, z - p.z) < diameter * 0.005),
    );
  const girdle = outer.length
      ? outer.reduce((n, p) => n + p.y, 0) / outer.length
      : h * 0.15,
    base = -h * 0.52;
  const rail = Math.min(0.025, diameter * 0.055),
    upright = Math.min(0.018, diameter * 0.04),
    lift = Math.min(0.07, diameter * 0.15);
  const ring = (scale, y, radius = rail) =>
    wire(
      hull.map((p) => new THREE.Vector3(p[0] * scale, y, p[1] * scale)),
      radius,
      metal,
      true,
    );
  group.add(native, ring(0.84, base + lift, rail));
  const bezel = type === "bezel" || type === "half-bezel" || type === "channel";
  if (bezel && type !== "channel") {
    const shape = new THREE.Shape(
      hull.map((p) => new THREE.Vector2(p[0] * 1.08, -p[1] * 1.08)),
    );
    shape.holes.push(
      new THREE.Path(
        [...hull]
          .reverse()
          .map((p) => new THREE.Vector2(p[0] * 0.96, -p[1] * 0.96)),
      ),
    );
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: girdle - base + 0.02,
      bevelEnabled: true,
      bevelSize: 0.007,
      bevelThickness: 0.007,
      bevelSegments: 3,
    });
    g.rotateX(-Math.PI / 2);
    const rim = new THREE.Mesh(g, metal);
    rim.position.y = base;
    rim.castShadow = true;
    group.add(rim);
  } else if (type !== "channel") {
    const count = type === "six-prong" ? 6 : type === "v-prong" ? 3 : 4;
    group.add(ring(0.97, girdle - rail * 1.5, rail));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + (count === 4 ? Math.PI / 4 : 0);
      const point = hull.reduce(
        (best, p) =>
          p[0] * Math.cos(a) + p[1] * Math.sin(a) >
          best[0] * Math.cos(a) + best[1] * Math.sin(a)
            ? p
            : best,
        hull[0],
      );
      const x = point[0],
        z = point[1];
      const prong = wire(
        [
          new THREE.Vector3(x * 0.72, base, z * 0.72),
          new THREE.Vector3(x * 1.07, girdle - rail, z * 1.07),
          new THREE.Vector3(x * 0.94, girdle + rail * 2.3, z * 0.94),
        ],
        diameter * 0.045,
        metal,
      );
      prong.userData.component = "bearing-prong";
      group.add(prong);
    }
  }
  // Four independent gallery uprights join the girdle rail to the lower support.
  for (let i = 0; i < 4; i++) {
    const p = hull[Math.floor((i / 4) * hull.length)];
    group.add(
      wire(
        [
          new THREE.Vector3(p[0] * 0.84, base + lift, p[1] * 0.84),
          new THREE.Vector3(p[0], girdle - rail * 1.5, p[1]),
        ],
        upright,
        metal,
      ),
    );
  }
  group.userData = {
    component: "stone-and-bearing",
    stone: id,
    cut: stoneShape(id),
    diameterCm: diameter,
    girdleY: girdle,
    pavilionBaseY: base,
  };
  return group;
}
function clasp(metal) {
  const g = new THREE.Group(),
    body = loop(0.11, 0.19, 0.035, metal);
  g.add(body);
  const gate = wire(
    [
      new THREE.Vector3(0.09, -0.08, 0),
      new THREE.Vector3(0.04, -0.13, 0),
      new THREE.Vector3(-0.06, -0.13, 0),
    ],
    0.021,
    metal,
  );
  g.add(gate);
  const pivot = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 12), metal);
  pivot.position.set(0.09, -0.06, 0);
  g.add(pivot);
  g.userData.component = "lobster-body-gate-pivot";
  return g;
}
function chain(root, design, metal, rx = 5.5, rz = 7, centerY = 0.12) {
  const type = design.id.includes("curb")
    ? "curb"
    : design.id.includes("figaro")
      ? "figaro"
      : "cable";
  const path = new THREE.EllipseCurve(0, 0, rx, rz, 0, TAU, false, 0);
  const count = Math.round(path.getLength() / 0.23);
  const weights = Array.from({ length: count }, (_, i) =>
      type === "figaro" && i % 4 === 0 ? 1.55 : 1,
    ),
    total = weights.reduce((a, b) => a + b, 0);
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const t = (cursor + weights[i] / 2) / total;
    cursor += weights[i];
    const point = path.getPointAt(t),
      tangent2 = path.getTangentAt(t);
    const n = loop(0.165 * weights[i], 0.085, 0.019, metal),
      tangent = new THREE.Vector3(tangent2.x, 0, tangent2.y).normalize();
    const vertical = new THREE.Vector3(0, 1, 0),
      normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const cross =
      type === "cable" && i % 2
        ? vertical
        : normal.clone().applyAxisAngle(tangent, type === "curb" ? 0.45 : 0);
    n.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(
        tangent,
        cross,
        new THREE.Vector3().crossVectors(tangent, cross),
      ),
    );
    n.position.set(point.x, centerY, point.y);
    n.userData.component = type + "-link";
    root.add(n);
  }
  const lock = clasp(metal);
  lock.rotation.x = Math.PI / 2;
  lock.position.set(0, centerY, rz + 0.15);
  root.add(lock);
}
export async function buildConstructedJewelry(lib, state) {
  const d = designs[state.pattern];
  if (!d) throw new Error("Unknown jewelry design");
  const root = new THREE.Group(),
    metals = ["yellow-gold", "white-gold", "rose-gold", "silver", "platinum"];
  const metalId = metals[state.palette] || metals[0],
    metal = domainMaterial(metalId, { finish: state.finish || "polished" });
  const diameter = (state.size || 17) / 10,
    stoneId = chooseStone(state, d),
    stoneSize = d.stoneSizeMm / 10;
  const stoneMaterial =
    byId[stoneId]?.pack === "gem"
      ? [
          "ruby",
          "emerald",
          "aquamarine",
          "amethyst",
          "sapphire",
          "citrine",
          "topaz",
        ].find((x) =>
          byId[stoneId].variant.toLowerCase().includes(
            {
              ruby: "рубин",
              emerald: "изумруд",
              aquamarine: "аквамарин",
              amethyst: "аметист",
              sapphire: "сапфир",
              citrine: "цитрин",
              topaz: "топаз",
            }[x],
          ),
        ) || "diamond"
      : "diamond";
  const makeSetting = (id = stoneId, size = stoneSize, type = d.setting) =>
    setting(lib, id, size, type, metal, stoneMaterial);
  if (d.type === "ring") {
    const p = jewelParts["band-" + d.band],
      width = p.widthMm / 10,
      thickness = p.thicknessMm / 10;
    const band = new THREE.Mesh(
      sweptBand(diameter, width, thickness, p.profile),
      metal,
    );
    band.castShadow = true;
    band.userData.component = "band-" + d.band;
    root.add(band);
    if (d.id === "three-metal") {
      band.geometry.dispose();
      band.geometry = sweptBand(diameter, 0.17, 0.12);
      band.material = domainMaterial("yellow-gold", { finish: state.finish });
      for (const [i, id] of ["white-gold", "rose-gold"].entries()) {
        const b = new THREE.Mesh(
          sweptBand(diameter, 0.17, 0.12),
          domainMaterial(id, { finish: state.finish }),
        );
        b.position.z = (i ? 1 : -1) * 0.185;
        root.add(b);
      }
    } else if (["channel-band", "pave-band"].includes(d.id)) {
      const count = d.id === "pave-band" ? 23 : 13;
      for (let i = 0; i < count; i++) {
        const a = 0.27 + (i / (count - 1)) * (Math.PI - 0.54),
          seat = await makeSetting();
        seat.rotation.z = a - Math.PI / 2;
        seat.position.set(
          Math.cos(a) * (diameter / 2 + thickness + 0.09),
          Math.sin(a) * (diameter / 2 + thickness + 0.09),
          0,
        );
        root.add(seat);
      }
      if (d.id === "channel-band")
        for (const side of [-1, 1]) {
          const points = Array.from({ length: 64 }, (_, i) => {
            const a = 0.21 + (i / 63) * (Math.PI - 0.42);
            return new THREE.Vector3(
              Math.cos(a) * (diameter / 2 + thickness + 0.14),
              Math.sin(a) * (diameter / 2 + thickness + 0.14),
              side * 0.14,
            );
          });
          const wall = wire(points, 0.045, metal);
          wall.userData.component = "continuous-channel-wall";
          root.add(wall);
        }
    } else if (stoneId && stoneSize) {
      const centreY = diameter / 2 + thickness + stoneSize * 0.34;
      const seat = await makeSetting();
      seat.position.y = centreY;
      root.add(seat);
      for (const sign of [-1, 1]) {
        if (d.band === "bypass") {
          const angle = Math.PI / 2 - sign * 0.35,
            r = diameter / 2 + thickness / 2;
          const start = new THREE.Vector3(
            Math.cos(angle) * r,
            Math.sin(angle) * r,
            Math.cos(angle) * 0.17,
          );
          root.add(
            wire(
              [
                start,
                new THREE.Vector3(
                  sign * stoneSize * 0.6,
                  centreY - 0.2,
                  sign * 0.18,
                ),
                new THREE.Vector3(
                  -sign * stoneSize * 0.16,
                  centreY - stoneSize * 0.28,
                  sign * stoneSize * 0.46,
                ),
              ],
              thickness * 0.46,
              metal,
            ),
          );
          continue;
        }
        const start = new THREE.Vector3(
            sign * diameter * 0.28,
            diameter * 0.43,
            0,
          ),
          end = new THREE.Vector3(
            sign * stoneSize * 0.34,
            centreY - stoneSize * 0.3,
            0,
          );
        root.add(
          wire(
            [
              start,
              new THREE.Vector3(
                sign * stoneSize * 0.44,
                centreY - stoneSize * 0.35,
                0,
              ),
              end,
            ],
            0.052,
            metal,
          ),
        );
        if (d.band === "split") {
          for (const side of [-1, 1])
            root.add(
              wire(
                [
                  new THREE.Vector3(start.x, start.y, 0),
                  new THREE.Vector3(
                    sign * stoneSize * 0.55,
                    centreY - 0.18,
                    side * 0.13,
                  ),
                  new THREE.Vector3(end.x, end.y, side * 0.15),
                ],
                0.035,
                metal,
              ),
            );
        }
      }
      if (d.id === "trilogy")
        for (const sign of [-1, 1]) {
          const sideId = chooseStone(state, d, "trillion"),
            side = await makeSetting(sideId, 0.3, "bezel");
          side.position.set(sign * 0.5, centreY - 0.12, 0);
          root.add(side);
          for (const z of [-0.09, 0.09])
            root.add(
              wire(
                [
                  new THREE.Vector3(sign * diameter * 0.37, diameter * 0.37, z),
                  new THREE.Vector3(sign * 0.58, centreY - 0.32, z),
                  new THREE.Vector3(sign * 0.5, centreY - 0.2, z),
                ],
                0.045,
                metal,
              ),
            );
        }
      if (d.setting === "halo")
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TAU,
            small = await makeSetting(
              chooseStone(state, d, "round"),
              0.1,
              "four-prong",
            );
          small.position.set(
            Math.cos(a) * stoneSize * 0.65,
            centreY,
            Math.sin(a) * stoneSize * 0.65,
          );
          root.add(small);
        }
    }
  } else if (d.type === "earring") {
    for (const sign of [-1, 1]) {
      const e = new THREE.Group();
      e.position.x = sign * 0.8;
      if (d.id === "hoop") {
        const points = Array.from({ length: 64 }, (_, i) => {
          const a = Math.PI / 2 + 0.16 + (i / 63) * (TAU - 0.32);
          return new THREE.Vector3(Math.cos(a) * 0.48, Math.sin(a) * 0.62, 0);
        });
        e.add(wire(points, 0.045, metal));
        const pin = wire(
          [new THREE.Vector3(-0.08, 0.61, 0), new THREE.Vector3(0.08, 0.61, 0)],
          0.018,
          metal,
        );
        pin.userData.component = "hinged-ear-post";
        e.add(pin);
        const hinge = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.055, 0.11, 20),
          metal,
        );
        hinge.rotation.x = Math.PI / 2;
        hinge.position.y = -0.6;
        e.add(hinge);
      } else {
        const seat = await makeSetting();
        seat.rotation.x = Math.PI / 2;
        e.add(seat);
        const post = wire(
          [new THREE.Vector3(0, 0, -0.05), new THREE.Vector3(0, 0, -0.9)],
          0.025,
          metal,
        );
        e.add(post);
        for (const side of [-1, 1]) {
          const back = loop(0.075, 0.095, 0.022, metal);
          back.position.set(side * 0.075, 0, -0.69);
          back.rotation.y = side * 0.3;
          e.add(back);
        }
        if (d.id === "drop") {
          const hook = wire(
            [
              new THREE.Vector3(0, 0.3, 0),
              new THREE.Vector3(0, 0.85, 0),
              new THREE.Vector3(0, 1.1, 0.3),
              new THREE.Vector3(0, 0.5, 0.45),
            ],
            0.025,
            metal,
          );
          e.add(hook);
        }
      }
      root.add(e);
    }
  } else if (d.type === "chain") chain(root, d, metal);
  else if (d.type === "pendant") {
    chain(root, { id: "cable-chain" }, metal, 2.4, 3.2);
    const gem = await makeSetting();
    gem.rotation.x = Math.PI / 2;
    gem.position.set(0, 0.25, -3.5);
    root.add(gem);
    const bail = loop(0.11, 0.16, 0.026, metal);
    bail.rotation.x = Math.PI / 2;
    bail.position.set(0, 0.18, -3.2);
    root.add(bail);
  } else if (d.id === "bangle") {
    const g = loop(3.1, 2.65, 0.11, metal);
    g.rotation.x = Math.PI / 2;
    root.add(g);
  } else {
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU,
        seat = await makeSetting();
      seat.position.set(Math.cos(a) * 3, 0.16, Math.sin(a) * 2.6);
      root.add(seat);
      const link = loop(0.07, 0.1, 0.018, metal);
      link.rotation.x = Math.PI / 2;
      link.position.set(
        Math.cos(a + 0.065) * 3,
        0.13,
        Math.sin(a + 0.065) * 2.6,
      );
      root.add(link);
    }
    const lock = clasp(metal);
    lock.position.set(0, 0.14, 2.6);
    lock.rotation.x = Math.PI / 2;
    root.add(lock);
  }
  root.position.y -= bounds(root).min.y;
  root.userData = {
    pattern: d.id,
    assembly: {
      construction: d.type,
      material: metalId,
      parts: d.parts,
      sources: d.sources,
    },
    measure: `${d.name} · ${d.fixedMetals ? "Три оттенка золота 750" : metalId === "silver" ? "Серебро 925" : metalId === "platinum" ? "Платина 950" : "Золото 750"}${d.type === "ring" ? " · размер " + state.size : ""}`,
  };
  return root;
}
