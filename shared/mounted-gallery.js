import * as THREE from "three";
import { preciseBounds } from "./precise-fit.js";
import { physical } from "./model-library.js";

function vertices(root) {
  root.updateMatrixWorld(true);
  const points = [];
  root.traverse((n) => {
    if (!n.isMesh) return;
    const p = n.geometry.attributes.position;
    for (let i = 0; i < p.count; i++)
      points.push(
        new THREE.Vector3()
          .fromBufferAttribute(p, i)
          .applyMatrix4(n.matrixWorld),
      );
  });
  return points;
}

export function clearRingPavilion(base, frame, gem, color) {
  const body = preciseBounds(base),
    stone = preciseBounds(gem);
  const clearance = 0.025;
  const lift = Math.max(0, body.max.y + clearance - stone.min.y);
  if (lift < 1e-6) return null;
  frame.position.y += lift;
  gem.position.y += lift;
  frame.updateMatrixWorld(true);
  gem.updateMatrixWorld(true);
  const box = preciseBounds(frame),
    size = box.getSize(new THREE.Vector3());
  const cloud = vertices(frame);
  let lower = cloud.filter(
    (p) =>
      p.y <= box.min.y + size.y * 0.45 &&
      Math.abs(p.z) <= (body.max.z - body.min.z) * 0.45,
  );
  if (!lower.length)
    lower = cloud.filter((p) => p.y <= box.min.y + size.y * 0.45);
  if (!lower.length)
    throw new Error("Mounted gallery has no lower shoulder anchors");
  const gallery = new THREE.Group(),
    connections = [];
  const ray = new THREE.Raycaster();
  for (const side of [-1, 1]) {
    const end = lower
      .reduce(
        (best, p) => (!best || side * p.x > side * best.x ? p : best),
        null,
      )
      .clone();
    const z = THREE.MathUtils.clamp(end.z, body.min.z * 0.7, body.max.z * 0.7);
    ray.set(
      new THREE.Vector3(
        THREE.MathUtils.clamp(
          end.x * 1.35,
          body.min.x * 0.75,
          body.max.x * 0.75,
        ),
        body.max.y + 1,
        z,
      ),
      new THREE.Vector3(0, -1, 0),
    );
    const hit = ray.intersectObject(base, true)[0];
    if (!hit) throw new Error("Gallery shoulder misses the native ring body");
    const start = hit.point.clone();
    const radius = Math.max(0.02, Math.min(0.055, size.x * 0.045));
    const direction = end.clone().sub(start),
      length = direction.length();
    const from = start
      .clone()
      .addScaledVector(direction.clone().normalize(), -radius * 0.5);
    const to = end
      .clone()
      .addScaledVector(direction.clone().normalize(), radius * 0.5);
    const curve = new THREE.CubicBezierCurve3(
      from,
      from.clone().add(new THREE.Vector3(0, length * 0.4, 0)),
      to.clone().add(new THREE.Vector3(0, -length * 0.25, 0)),
      to,
    );
    const geometry = new THREE.TubeGeometry(curve, 24, radius, 16, false);
    const positions = geometry.attributes.position;
    for (let ring = 0; ring <= 24; ring++) {
      const center = curve.getPointAt(ring / 24),
        taper = THREE.MathUtils.lerp(1.45, 1, ring / 24);
      for (let edge = 0; edge <= 16; edge++) {
        const i = ring * 17 + edge,
          p = new THREE.Vector3()
            .fromBufferAttribute(positions, i)
            .sub(center)
            .multiplyScalar(taper)
            .add(center);
        positions.setXYZ(i, p.x, p.y, p.z);
      }
    }
    geometry.computeVertexNormals();
    const rod = new THREE.Mesh(geometry, physical(color, "metal"));
    rod.castShadow = rod.receiveShadow = true;
    gallery.add(rod);
    connections.push({ start: start.toArray(), end: end.toArray(), radius });
  }
  gallery.userData.component = "native-ring-gallery";
  gallery.userData.pavilionClearance = { lift, clearance, connections };
  return gallery;
}
