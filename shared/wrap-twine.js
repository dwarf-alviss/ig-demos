import * as THREE from "three";
import { bounds, place } from "./model-library.js";
// Fit the supplied oval rope to the measured wrapper contour at the knot height.
// Geometry and UVs are retained; horizontal displacement follows 72 body rays.
export function fitWrapTwine(
  ribbon,
  wrapper,
  { x, y, z, rx, rz, limit, thickness },
) {
  ribbon.updateMatrixWorld(true);
  wrapper.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(),
    radii = [];
  for (let i = 0; i < 72; i++) {
    const angle = (i * Math.PI * 2) / 72;
    ray.set(
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
    );
    const hit = ray
      .intersectObject(wrapper, true)
      .filter((h) => h.distance <= limit)
      .at(-1);
    radii.push(hit ? hit.distance + thickness + 0.04 : null);
  }
  ribbon.traverse((n) => {
    if (!n.isMesh) return;
    const a = n.geometry.getAttribute("position"),
      inverse = n.matrixWorld.clone().invert();
    for (let i = 0; i < a.count; i++) {
      const p = new THREE.Vector3()
          .fromBufferAttribute(a, i)
          .applyMatrix4(n.matrixWorld),
        dx = p.x - x,
        dz = p.z - z;
      const angle = (Math.atan2(dz, dx) + Math.PI * 2) % (Math.PI * 2),
        sample = (angle / (Math.PI * 2)) * 72,
        j = Math.floor(sample),
        t = sample - j;
      const r0 = radii[j],
        r1 = radii[(j + 1) % 72];
      if (r0 === null || r1 === null) continue;
      const target = r0 * (1 - t) + r1 * t,
        previous =
          1 /
          Math.sqrt(
            Math.cos(angle) ** 2 / rx ** 2 + Math.sin(angle) ** 2 / rz ** 2,
          ),
        distance = Math.hypot(dx, dz);
      const shifted = Math.max(0.1, distance + target - previous);
      p.x = x + Math.cos(angle) * shifted;
      p.z = z + Math.sin(angle) * shifted;
      p.applyMatrix4(inverse);
      a.setXYZ(i, p.x, p.y, p.z);
    }
    a.needsUpdate = true;
    n.geometry.computeVertexNormals();
    n.geometry.computeBoundingBox();
    n.geometry.computeBoundingSphere();
  });
}

export function attachWrapperRibbon(
  ribbon,
  wrapper,
  { width: packWidth, centerX = 0, y: bowY, h, hat = false, twine = false },
) {
  let ringCenterZ = 0,
    ringCenterY = 0,
    ringFit;
  if (twine) {
    wrapper.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(),
      origin = new THREE.Vector3(centerX, bowY, 0);
    const radius = (direction, limit = packWidth * 0.6) => {
      ray.set(origin, new THREE.Vector3(...direction));
      return ray
        .intersectObject(wrapper, true)
        .filter((h) => h.distance <= limit)
        .at(-1)?.distance;
    };
    const rz = radius([0, 0, 1]),
      lz = radius([0, 0, -1]),
      bodyLimit = hat && rz && lz ? (rz + lz) * 0.58 : packWidth * 0.6;
    const rx = radius([1, 0, 0], bodyLimit),
      lx = radius([-1, 0, 0], bodyLimit);
    const originalBounds = bounds(ribbon),
      dimensions = originalBounds.getSize(new THREE.Vector3()),
      originalCenter = originalBounds.getCenter(new THREE.Vector3());
    const sidePoints = [];
    ribbon.traverse((n) => {
      if (!n.isMesh) return;
      const positions = n.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const p = new THREE.Vector3()
          .fromBufferAttribute(positions, i)
          .applyMatrix4(n.matrixWorld);
        if (Math.abs(p.x - originalCenter.x) > dimensions.x * 0.495)
          sidePoints.push(p);
      }
    });
    const middle = (values) =>
      values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const sourceRingZ = middle(sidePoints.map((p) => p.z)),
      sourceRingY = middle(sidePoints.map((p) => p.y));
    ringCenterY = sourceRingY - originalCenter.y;
    if (rx && lx) ribbon.scale.x *= (rx + lx + 0.22) / dimensions.x;
    if (rz && lz) {
      const zFactor =
        (rz + lz + 0.22) / (2 * (sourceRingZ - originalBounds.min.z));
      ribbon.scale.z *= zFactor;
      ribbon.updateMatrixWorld(true);
      ringCenterZ =
        (sourceRingZ - originalCenter.z) * zFactor - (rz - lz) * 0.5;
      if (rx && lx)
        ringFit = {
          x: centerX + (rx - lx) * 0.5,
          y: bowY,
          z: (rz - lz) * 0.5,
          rx: (rx + lx + 0.22) * 0.5,
          rz: (rz + lz + 0.22) * 0.5,
          limit: Math.max(rx + lx, rz + lz) * 0.62,
          thickness:
            Math.max(...sidePoints.map((p) => p.y)) -
            Math.min(...sidePoints.map((p) => p.y)),
        };
    }
  }
  let frontZ = 0;
  wrapper.traverse((n) => {
    if (!n.isMesh) return;
    const a = n.geometry.getAttribute("position");
    for (let i = 0; i < a.count; i += 8) {
      const p = new THREE.Vector3(a.getX(i), a.getY(i), a.getZ(i)).applyMatrix4(
        n.matrixWorld,
      );
      if (
        Math.abs(p.y - bowY) < h * 0.05 &&
        Math.abs(p.x - centerX) < packWidth * 0.18
      )
        frontZ = Math.max(frontZ, p.z);
    }
  });
  frontZ += 0.35;
  place(
    ribbon,
    ringFit?.x ?? centerX,
    bowY - ringCenterY,
    twine ? -ringCenterZ : frontZ,
    "center",
  );
  if (ringFit) fitWrapTwine(ribbon, wrapper, ringFit);
  return ribbon;
}
