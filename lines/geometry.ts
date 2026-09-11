export interface Point { x: number; y: number }
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export function curve(a: Point, b: Point, c: Point, d: Point, steps = 24): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps, u = 1 - t;
    return { x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x, y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y };
  });
}
export function contour(x: number, y: number, w: number, h: number, radius = 5): Point[] {
  const r = Math.min(radius, w / 2, h / 2), result: Point[] = [{ x: x + r, y }];
  for (const [cx, cy, angle] of [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]]) {
    for (let i = 0; i <= 6; i++) result.push({ x: cx + Math.cos(angle + i / 6 * Math.PI / 2) * r, y: cy + Math.sin(angle + i / 6 * Math.PI / 2) * r });
  }
  result.push(result[0]); return result;
}
export function measure(points: Point[]) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  return { lengths, length: lengths.at(-1) ?? 0 };
}
export function pointAt(points: Point[], lengths: number[], distance: number): Point {
  for (let i = 1; i < points.length; i++) if (lengths[i] >= distance) {
    const t = clamp((distance - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1));
    return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t };
  }
  return points.at(-1) ?? { x: 0, y: 0 };
}
