import * as THREE from "three";
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
