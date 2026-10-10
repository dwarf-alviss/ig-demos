import * as THREE from "three";
// Inscribed circle from horizontal cuts of the supplied woven basket mesh.
// Every triangle edge is retained; a guessed mouth radius is not a floor fit.
export function basketInteriorRadius(root, centerX, top, height = 2.2) {
  root.updateMatrixWorld(true);
  let radius = Infinity,
    samples = 0;
  const center = new THREE.Vector3(centerX, 0, 0),
    line = new THREE.Line3(),
    closest = new THREE.Vector3();
  for (let level = 0; level <= 8; level++) {
    const y = top - height + (height * level) / 8;
    center.y = y;
    let levelRadius = Infinity,
      hits = 0;
    root.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const p = mesh.geometry.attributes.position,
        index = mesh.geometry.index;
      for (let i = 0; i < (index?.count ?? p.count); i += 3) {
        const v = [0, 1, 2].map((j) =>
            new THREE.Vector3()
              .fromBufferAttribute(p, index ? index.getX(i + j) : i + j)
              .applyMatrix4(mesh.matrixWorld),
          ),
          cut = [];
        for (let j = 0; j < 3; j++) {
          const a = v[j],
            b = v[(j + 1) % 3];
          if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y))
            cut.push(a.clone().lerp(b, (y - a.y) / (b.y - a.y)));
        }
        if (cut.length !== 2) continue;
        line.set(cut[0], cut[1]);
        line.closestPointToPoint(center, true, closest);
        levelRadius = Math.min(
          levelRadius,
          Math.hypot(closest.x - centerX, closest.z),
        );
        hits++;
      }
    });
    if (hits < 12 || !Number.isFinite(levelRadius))
      throw Error(
        "No complete basket body cross section at support level " + y,
      );
    samples += hits;
    radius = Math.min(radius, levelRadius);
  }
  if (radius < 1)
    throw Error("Floral support reaches basket floor; need a shallower block");
  return { radius: radius - 0.08, samples };
}
export function fitBasketInsertion(point, centerX, limit) {
  const dx = point.x - centerX,
    dz = point.z,
    r = Math.hypot(dx, dz);
  if (r > limit) {
    point.x = centerX + (dx * limit) / r;
    point.z = (dz * limit) / r;
  }
}
