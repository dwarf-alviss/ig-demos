import * as THREE from "three";
import profiles from "./prong-sockets.json" with { type: "json" };
import { bake } from "./model-library.js";
import { preciseFit, preciseBounds } from "./precise-fit.js";
import { byId } from "./catalogue.js";
import { stoneShape } from "./jewelry-rules.js";
import { convexHull } from "./fitted-cast.js";
import { disposeTree } from "./scene-utils.js";
const TAU = Math.PI * 2;
export function outlineAt(hull, angle) {
  const d = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
  let radius = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = new THREE.Vector2(...hull[i]),
      b = new THREE.Vector2(...hull[(i + 1) % hull.length]),
      e = b.clone().sub(a);
    const cross = (v, w) => v.x * w.y - v.y * w.x,
      den = cross(d, e);
    if (Math.abs(den) < 1e-10) continue;
    const r = cross(a, e) / den,
      t = cross(a, d) / den;
    if (r >= 0 && t >= 0 && t <= 1) radius = Math.min(radius, r);
  }
  if (!Number.isFinite(radius))
    throw Error("Gem outline does not enclose its centre");
  return radius;
}
export async function fittedNativeProngs(lib, mount, id, socket, color) {
  const profile = profiles[mount],
    width = socket.width * 1.32;
  let gem = await lib.get(id, {
    size: 1,
    axis: "x",
    role: "gem",
    color: byId[id].color,
    rotation: (byId[id].face || "y") === "z" ? [-Math.PI / 2, 0, 0] : null,
  });
  if (["princess", "cushion"].includes(stoneShape(id)))
    gem.rotateY(Math.PI / 4);
  gem = preciseFit(gem, width * 0.84);
  const box = preciseBounds(gem),
    center = box.getCenter(new THREE.Vector3()),
    cloud = [];
  gem.traverse((n) => {
    if (!n.isMesh) return;
    const a = n.geometry.attributes.position;
    for (let i = 0; i < a.count; i++)
      cloud.push(
        new THREE.Vector3()
          .fromBufferAttribute(a, i)
          .applyMatrix4(n.matrixWorld),
      );
  });
  const hull = convexHull(cloud.map((p) => [p.x - center.x, p.z - center.z]));
  const outer = cloud.filter((p) =>
    hull.some(
      ([x, z]) =>
        Math.hypot(p.x - center.x - x, p.z - center.z - z) < width * 0.004,
    ),
  );
  const girdle = outer.reduce((v, p) => v + p.y, 0) / outer.length,
    seat = profile.height * width * 0.77;
  gem.position.add(new THREE.Vector3(-center.x, seat - girdle, -center.z));
  const source = await lib.get(mount, {
    size: 1,
    axis: "x",
    role: "metal",
    color,
  });
  const normalized = preciseFit(source, width),
    metal = bake(normalized, true);
  disposeTree(normalized);
  const caps = profile.caps
    .map((c) => {
      const x = c.center[0] * width,
        z = c.center[2] * width,
        a = (Math.atan2(z, x) + TAU) % TAU,
        r = outlineAt(hull, a) + Math.min(c.width, c.depth) * width * 0.16;
      return {
        angle: a,
        dx: Math.cos(a) * r - x,
        dz: Math.sin(a) * r - z,
        position: [Math.cos(a) * r, seat + width * 0.027, Math.sin(a) * r],
      };
    })
    .sort((a, b) => a.angle - b.angle);
  metal.traverse((n) => {
    if (!n.isMesh) return;
    const a = n.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i),
        y = a.getY(i),
        z = a.getZ(i),
        angle = (Math.atan2(z, x) + TAU) % TAU;
      let next = caps.findIndex((c) => c.angle >= angle);
      if (next < 0) next = 0;
      const after = caps[next],
        before = caps[(next + caps.length - 1) % caps.length];
      const t =
          ((angle - before.angle + TAU) % TAU) /
          ((after.angle - before.angle + TAU) % TAU),
        blend = Math.min(1, y / (profile.height * width * 0.7));
      const dx = THREE.MathUtils.lerp(before.dx, after.dx, t),
        dz = THREE.MathUtils.lerp(before.dz, after.dz, t);
      const sourceHeight = profile.height * width,
        capBase = sourceHeight * 0.9,
        targetTop = seat + width * 0.035;
      const yy =
        y >= capBase
          ? targetTop + (y - sourceHeight)
          : (y / capBase) * (targetTop - sourceHeight * 0.1);
      a.setXYZ(i, x + dx * blend, yy, z + dz * blend);
    }
    a.needsUpdate = true;
    n.geometry.computeVertexNormals();
    n.geometry.computeBoundingBox();
    n.geometry.computeBoundingSphere();
  });
  const frame = new THREE.Group();
  frame.add(metal);
  if (socket.face === "z") frame.rotation.x = Math.PI / 2;
  const b = preciseBounds(frame),
    c = b.getCenter(new THREE.Vector3());
  frame.position.set(
    socket.x - c.x,
    socket.y - (socket.face === "y" ? b.min.y : c.y),
    socket.z - c.z,
  );
  frame.updateMatrixWorld(true);
  const stone = new THREE.Group();
  stone.add(gem);
  stone.applyMatrix4(frame.matrixWorld);
  stone.updateMatrixWorld(true);
  stone.userData.nativeSeat = {
    setting: mount,
    stone: id,
    uniformScale: gem.scale.x,
    girdle: seat,
    prongs: caps.map((c) => c.position),
  };
  return { root: frame, stone };
}
