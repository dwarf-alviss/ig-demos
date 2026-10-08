import * as THREE from "three";

// Use the supplied woven handle triangles. Its projected silhouette alone
// cannot distinguish a flower below the arch from a flower piercing the rope.
export function basketHandleContact(wrapper, lip) {
  const cell = 1.5,
    triangles = [],
    grid = new Map(),
    points = [];
  const key = (x, y, z) => `${x},${y},${z}`;
  const visitCells = (box, visit) => {
    for (
      let x = Math.floor(box.min.x / cell);
      x <= Math.floor(box.max.x / cell);
      x++
    )
      for (
        let y = Math.floor(box.min.y / cell);
        y <= Math.floor(box.max.y / cell);
        y++
      )
        for (
          let z = Math.floor(box.min.z / cell);
          z <= Math.floor(box.max.z / cell);
          z++
        )
          visit(key(x, y, z));
  };
  wrapper.updateMatrixWorld(true);
  wrapper.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const position = mesh.geometry.attributes.position,
      index = mesh.geometry.index;
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const triangle = [0, 1, 2].map((j) =>
        new THREE.Vector3()
          .fromBufferAttribute(position, index ? index.getX(i + j) : i + j)
          .applyMatrix4(mesh.matrixWorld),
      );
      if (Math.max(...triangle.map((p) => p.y)) <= lip + 0.3) continue;
      const id = triangles.push(triangle) - 1;
      visitCells(new THREE.Box3().setFromPoints(triangle), (k) => {
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(id);
      });
      points.push(...triangle.filter((p) => p.y > lip + 1.2));
    }
  });
  const centre = points
    .reduce((v, p) => v.add(p), new THREE.Vector3())
    .divideScalar(points.length || 1);
  const xx = points.reduce((s, p) => s + (p.x - centre.x) ** 2, 0),
    zz = points.reduce((s, p) => s + (p.z - centre.z) ** 2, 0),
    xz = points.reduce((s, p) => s + (p.x - centre.x) * (p.z - centre.z), 0);
  const angle = Math.atan2(2 * xz, xx - zz) / 2;
  const normal = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
  const ray = new THREE.Ray(),
    direction = new THREE.Vector3(),
    hit = new THREE.Vector3(),
    box = new THREE.Box3();
  const segmentHits = (a, b) => {
    for (let i = 0; i < 3; i++) {
      direction.subVectors(a[(i + 1) % 3], a[i]);
      const length = direction.length();
      if (length < 1e-8) continue;
      ray.set(a[i], direction.divideScalar(length));
      if (ray.intersectTriangle(b[0], b[1], b[2], false, hit)) {
        const distance = hit.distanceTo(a[i]);
        if (distance > 1e-5 && distance < length - 1e-5) return true;
      }
    }
    return false;
  };
  function intersects(head, coreRadius = 0) {
    let collision = false;
    head.updateMatrixWorld(true);
    if (coreRadius > 0) {
      const bounds = new THREE.Box3().setFromObject(head, true);
      const centre = bounds.getCenter(new THREE.Vector3());
      const height = bounds.max.y - bounds.min.y;
      const capsule = [-0.25, 0, 0.25].map((f) =>
        centre.clone().add(new THREE.Vector3(0, height * f, 0)),
      );
      const triangle = new THREE.Triangle();
      for (const vertices of triangles) {
        triangle.set(...vertices);
        for (const point of capsule)
          if (
            triangle.closestPointToPoint(point, hit).distanceTo(point) <
            coreRadius
          )
            return true;
      }
    }
    head.traverse((mesh) => {
      if (collision || !mesh.isMesh) return;
      const position = mesh.geometry.attributes.position,
        index = mesh.geometry.index;
      const triangle = [
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ];
      for (let i = 0; i < (index?.count ?? position.count); i += 3) {
        for (let j = 0; j < 3; j++)
          triangle[j]
            .fromBufferAttribute(position, index ? index.getX(i + j) : i + j)
            .applyMatrix4(mesh.matrixWorld);
        box.setFromPoints(triangle);
        const candidates = new Set();
        visitCells(box, (k) => {
          for (const id of grid.get(k) || []) candidates.add(id);
        });
        for (const id of candidates)
          if (
            segmentHits(triangle, triangles[id]) ||
            segmentHits(triangles[id], triangle)
          ) {
            collision = true;
            return;
          }
      }
    });
    return collision;
  }
  return { intersects, normal, triangleCount: triangles.length };
}
