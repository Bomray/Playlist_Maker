// Tracé SVG d'une courbe lissée. Interpolation « monotone » (Fritsch-Carlson) : la courbe passe
// par chaque point sans dépasser entre deux (elle ne descend jamais sous zéro, contrairement à
// une simple spline de Bézier).
export interface XY {
  x: number;
  y: number;
}

const r = (n: number) => Math.round(n * 100) / 100;

export function smoothPath(points: readonly XY[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M${r(points[0]!.x)},${r(points[0]!.y)}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1]!.x - points[i]!.x);
    slope.push((points[i + 1]!.y - points[i]!.y) / (dx[i] || 1));
  }
  // Tangente en chaque point : nulle aux extrema locaux, moyenne harmonique sinon.
  const tangent = points.map((_, i) => {
    if (i === 0) return slope[0]!;
    if (i === n - 1) return slope[n - 2]!;
    const a = slope[i - 1]!;
    const b = slope[i]!;
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });

  let d = `M${r(points[0]!.x)},${r(points[0]!.y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p = points[i]!;
    const q = points[i + 1]!;
    const h = dx[i]! / 3;
    d += `C${r(p.x + h)},${r(p.y + tangent[i]! * h)} ${r(q.x - h)},${r(q.y - tangent[i + 1]! * h)} ${r(q.x)},${r(q.y)}`;
  }
  return d;
}
