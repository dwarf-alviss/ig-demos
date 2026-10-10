function pointSegment(x, z, s) {
  const dx = s.bx - s.ax,
    dz = s.bz - s.az;
  const t = Math.max(
    0,
    Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz || 1)),
  );
  return Math.hypot(x - s.ax - dx * t, z - s.az - dz * t);
}
function segmentDistance(a, b) {
  const dx = a.bx - a.ax,
    dz = a.bz - a.az,
    ex = b.bx - b.ax,
    ez = b.bz - b.az;
  const cross = dx * ez - dz * ex;
  if (Math.abs(cross) > 1e-9) {
    const x = b.ax - a.ax,
      z = b.az - a.az;
    const t = (x * ez - z * ex) / cross,
      u = (x * dz - z * dx) / cross;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  return Math.min(
    pointSegment(a.ax, a.az, b),
    pointSegment(a.bx, a.bz, b),
    pointSegment(b.ax, b.az, a),
    pointSegment(b.bx, b.bz, a),
  );
}
export function cakeSeatsOverlap(a, b, margin = 0.16) {
  const distance =
    a.capsule && b.capsule
      ? segmentDistance(a.capsule, b.capsule)
      : a.capsule
        ? pointSegment(b.x, b.z, a.capsule)
        : b.capsule
          ? pointSegment(a.x, a.z, b.capsule)
          : Math.hypot(a.x - b.x, a.z - b.z);
  return distance < a.footprint + b.footprint + margin;
}
