import { openingRotation } from "./socket-orientation.js";
import * as THREE from "three";
import profiles from "./setting-sockets.json" with { type: "json" };
import { bounds, place, bake } from "./model-library.js";
import { preciseBounds, preciseFit } from "./precise-fit.js";
import { disposeTree } from "./scene-utils.js";
import { byId } from "./catalogue.js";

function points(root) {
  root.updateMatrixWorld(true);
  const result = [];
  root.traverse((n) => {
    if (!n.isMesh) return;
    const a = n.geometry.attributes.position;
    for (let i = 0; i < a.count; i++)
      result.push(
        new THREE.Vector3()
          .fromBufferAttribute(a, i)
          .applyMatrix4(n.matrixWorld),
      );
  });
  return result;
}

export async function nativeSetting(lib, id, socket, color, stoneId) {
  const profile = structuredClone(profiles[id]);
  const raw = await lib.get(id, {
    size: 1,
    axis: "x",
    role: "metal",
    color,
    rotation: profile.initial,
  });
  const aligned = new THREE.Group();
  aligned.add(raw);
  aligned.quaternion.fromArray(profile.alignment);
  const width = socket.width * 1.32;
  let local = preciseFit(aligned, width);
  if (stoneId) {
    const prototype = await lib.get(stoneId, {
      size: 1,
      axis: "x",
      role: "gem",
      color: byId[stoneId].color,
      rotation:
        (byId[stoneId].face || "y") === "z" ? [-Math.PI / 2, 0, 0] : null,
    });
    const size = preciseBounds(prototype).getSize(new THREE.Vector3()),
      h = profile.hole;
    const hw = h.max[0] - h.min[0],
      hd = h.max[1] - h.min[1];
    const orientation = openingRotation(
      points(prototype).map((p) => [p.x, p.z]),
      h.boundary,
    );
    const ratio = orientation.quarter % 2 ? size.x / size.z : size.z / size.x;
    profile.orientationQuarter = orientation.quarter;
    profile.orientationError = orientation.error;
    const factor = (ratio * hw) / hd,
      cz = (h.min[1] + h.max[1]) / 2,
      half = (hd * width) / 2;
    // Widen the opening; preserve the thickness beyond either inner wall.
    const previous = local;
    local = bake(previous, true);
    disposeTree(previous);
    local.traverse((n) => {
      if (!n.isMesh) return;
      const a = n.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const dz = a.getZ(i) - cz * width,
          sgn = Math.sign(dz),
          v = Math.abs(dz);
        a.setZ(
          i,
          cz * width +
            sgn * (v <= half ? v * factor : half * factor + v - half),
        );
      }
      a.needsUpdate = true;
      n.geometry.computeVertexNormals();
      n.geometry.computeBoundingBox();
      n.geometry.computeBoundingSphere();
    });
    h.min[1] = cz + (h.min[1] - cz) * factor;
    h.max[1] = cz + (h.max[1] - cz) * factor;
    h.boundary = h.boundary.map(([x, z]) => [x, cz + (z - cz) * factor]);
    profile.apertureDepthFactor = factor;
    disposeTree(prototype);
  }
  const root = new THREE.Group();
  root.add(local);
  if (socket.face === "z") root.rotation.x = Math.PI / 2;
  const box = preciseBounds(root),
    center = box.getCenter(new THREE.Vector3());
  root.position.add(
    new THREE.Vector3(
      socket.x - center.x,
      socket.y - (socket.face === "y" ? box.min.y : center.y),
      socket.z - center.z,
    ),
  );
  root.updateMatrixWorld(true);
  return { id, root, local, width, profile, face: socket.face };
}

export async function seatNativeGem(lib, id, setting) {
  const { profile, width, local, root } = setting;
  const stone = await lib.get(id, {
    size: 1,
    axis: "x",
    role: "gem",
    color: byId[id].color,
    rotation: (byId[id].face || "y") === "z" ? [-Math.PI / 2, 0, 0] : null,
  });
  const source = points(stone),
    box = preciseBounds(stone),
    center = box.getCenter(new THREE.Vector3());
  const hole = profile.hole;
  const hx = (hole.min[0] + hole.max[0]) / 2,
    hz = (hole.min[1] + hole.max[1]) / 2;
  let best = null;
  // Match the original cut to the opening by rigid rotations and one uniform scale.
  for (let quarter = 0; quarter < 4; quarter++) {
    if (
      profile.orientationQuarter !== undefined &&
      quarter !== profile.orientationQuarter
    )
      continue;
    const angle = (quarter * Math.PI) / 2,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const outline = source.map((p) => [
      c * (p.x - center.x) + s * (p.z - center.z),
      -s * (p.x - center.x) + c * (p.z - center.z),
    ]);
    const b = new THREE.Box2().setFromPoints(
        outline.map((p) => new THREE.Vector2(...p)),
      ),
      size = b.getSize(new THREE.Vector2());
    const scale =
      Math.min(
        (hole.max[0] - hole.min[0]) / size.x,
        (hole.max[1] - hole.min[1]) / size.y,
      ) * 1.035;
    const bins = Array(64).fill(0);
    for (const [x, z] of outline) {
      const a = (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2),
        i = Math.floor((a / (Math.PI * 2)) * 64);
      bins[i] = Math.max(bins[i], Math.hypot(x, z) * scale);
    }
    let score = 0;
    for (const [x, z] of hole.boundary) {
      const a = (Math.atan2(z - hz, x - hx) + Math.PI * 2) % (Math.PI * 2),
        i = Math.floor((a / (Math.PI * 2)) * 64);
      score += (Math.hypot(x - hx, z - hz) - bins[i]) ** 2;
    }
    if (!best || score < best.score) best = { angle, scale, score };
  }
  const radial = source.map((p) => Math.hypot(p.x - center.x, p.z - center.z)),
    max = Math.max(...radial);
  const outer = source
    .filter((p, i) => radial[i] > max * 0.94)
    .map((p) => p.y)
    .sort((a, b) => a - b);
  const girdle = outer[Math.floor(outer.length / 2)];
  const pivot = new THREE.Group();
  stone.position.sub(new THREE.Vector3(center.x, girdle, center.z));
  pivot.add(stone);
  pivot.rotation.y = best.angle;
  pivot.scale.setScalar(best.scale * width);
  pivot.position.set(hx * width, profile.seatY * width, hz * width);
  local.updateMatrixWorld(true);
  // Use the exact same rigid frame for both the metal and the stone.
  const assembly = new THREE.Group();
  assembly.add(pivot);
  assembly.applyMatrix4(root.matrixWorld);
  assembly.updateMatrixWorld(true);
  assembly.userData.nativeSeat = {
    setting: setting.id,
    normal: [0, setting.face === "y" ? 1 : 0, setting.face === "z" ? 1 : 0],
    uniformScale: best.scale * width,
    girdle: profile.seatY * width,
    openingCenter: [hx * width, hz * width],
    rotation: best.angle,
    outlineError: best.score / hole.boundary.length,
    apertureDepthFactor: profile.apertureDepthFactor,
    orientationError: profile.orientationError,
  };
  return assembly;
}
