import * as THREE from "three";
export function principalPlane(points) {
  const mean = points
      .reduce((v, p) => v.add(p), new THREE.Vector3())
      .divideScalar(points.length),
    m = Array.from({ length: 3 }, () => [0, 0, 0]),
    v = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  for (const point of points) {
    const p = point.clone().sub(mean).toArray();
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) m[i][j] += (p[i] * p[j]) / points.length;
  }
  for (let pass = 0; pass < 32; pass++) {
    let a = 0,
      b = 1;
    for (const [i, j] of [
      [0, 2],
      [1, 2],
    ])
      if (Math.abs(m[i][j]) > Math.abs(m[a][b])) {
        a = i;
        b = j;
      }
    if (Math.abs(m[a][b]) < 1e-12) break;
    const t = 0.5 * Math.atan2(2 * m[a][b], m[b][b] - m[a][a]),
      c = Math.cos(t),
      s = Math.sin(t);
    const aa = m[a][a],
      bb = m[b][b],
      ab = m[a][b];
    for (let k = 0; k < 3; k++)
      if (k !== a && k !== b) {
        const x = m[k][a],
          y = m[k][b];
        m[k][a] = m[a][k] = c * x - s * y;
        m[k][b] = m[b][k] = s * x + c * y;
      }
    m[a][a] = c * c * aa - 2 * c * s * ab + s * s * bb;
    m[b][b] = s * s * aa + 2 * c * s * ab + c * c * bb;
    m[a][b] = m[b][a] = 0;
    for (let k = 0; k < 3; k++) {
      const x = v[k][a],
        y = v[k][b];
      v[k][a] = c * x - s * y;
      v[k][b] = s * x + c * y;
    }
  }
  const min = [0, 1, 2].sort((a, b) => m[a][a] - m[b][b])[0],
    normal = new THREE.Vector3(v[0][min], v[1][min], v[2][min]);
  if (normal.y < 0) normal.negate();
  return {
    normal: normal.toArray(),
    mean: mean.toArray(),
    variances: m.map((r, i) => r[i]),
  };
}
