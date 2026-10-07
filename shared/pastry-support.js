import surfaces from "./pastry-surfaces.json" with { type: "json" };
export function pastryHeight(id, x, z) {
  const s = surfaces[id];
  if (!s) return null;
  const nx = ((x - s.minX) / (s.maxX - s.minX)) * (s.resolution - 1),
    nz = ((z - s.minZ) / (s.maxZ - s.minZ)) * (s.resolution - 1);
  if (nx < 0 || nz < 0 || nx > s.resolution - 1 || nz > s.resolution - 1)
    return null;
  const x0 = Math.floor(nx),
    z0 = Math.floor(nz),
    x1 = Math.min(x0 + 1, s.resolution - 1),
    z1 = Math.min(z0 + 1, s.resolution - 1);
  const values = [
    s.samples[z0 * s.resolution + x0],
    s.samples[z0 * s.resolution + x1],
    s.samples[z1 * s.resolution + x0],
    s.samples[z1 * s.resolution + x1],
  ];
  if (values.some((v) => v === null))
    return s.samples[Math.round(nz) * s.resolution + Math.round(nx)];
  const tx = nx - x0,
    tz = nz - z0;
  return (
    (values[0] * (1 - tx) + values[1] * tx) * (1 - tz) +
    (values[2] * (1 - tx) + values[3] * tx) * tz
  );
}
export function supportsDecoration(id, x, z, radius) {
  if (pastryHeight(id, x, z) === null) return false;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    if (
      pastryHeight(
        id,
        x + Math.cos(angle) * radius,
        z + Math.sin(angle) * radius,
      ) === null
    )
      return false;
  }
  return true;
}

const radii = Object.fromEntries(
  Object.entries(surfaces).map(([id, s]) => {
    let radius = 0;
    for (let z = 0; z < s.resolution; z++)
      for (let x = 0; x < s.resolution; x++)
        if (s.samples[z * s.resolution + x] !== null)
          radius = Math.max(
            radius,
            Math.hypot(
              s.minX + ((s.maxX - s.minX) * x) / (s.resolution - 1),
              s.minZ + ((s.maxZ - s.minZ) * z) / (s.resolution - 1),
            ),
          );
    return [id, radius + 0.2];
  }),
);
export const pastryFootprint = (id) => radii[id];
