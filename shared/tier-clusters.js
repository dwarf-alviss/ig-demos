// Search an asymmetric garnish group on the usable ledge, in centimeters.
function rayRadius(outline, angle) {
  const dx = Math.cos(angle),
    dz = Math.sin(angle);
  let result = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    const ex = b[0] - a[0],
      ez = b[1] - a[1],
      cross = dx * ez - dz * ex;
    if (Math.abs(cross) < 1e-9) continue;
    const r = (a[0] * ez - a[1] * ex) / cross;
    const t = (a[0] * dz - a[1] * dx) / cross;
    if (r > 0 && t >= 0 && t <= 1) result = Math.min(result, r);
  }
  return result;
}
export function tierClusterPoint(surface, footprint, attempt, layout) {
  const local = attempt % 480;
  const focus =
    1.1 + surface.id * 0.14 + (layout === "wreath" && attempt >= 480 ? 2.5 : 0);
  const angle =
    focus + Math.sin(local * 2.399963) * (0.13 + Math.floor(local / 80) * 0.16);
  const outer =
    (surface.outline ? rayRadius(surface.outline, angle) : surface.radius) -
    footprint -
    0.12;
  const inner =
    (surface.exclusion ? rayRadius(surface.exclusion, angle) : surface.inner) +
    footprint +
    0.12;
  if (!Number.isFinite(outer + inner) || inner > outer) return null;
  const r = inner + (outer - inner) * (0.5 + Math.sin(local * 1.71) * 0.42);
  return {
    x: (surface.x || 0) + Math.cos(angle) * r,
    z: (surface.z || 0) + Math.sin(angle) * r,
  };
}
