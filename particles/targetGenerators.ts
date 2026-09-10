export interface Target { key?: string; glyph?: number; x: number; y: number; opacity?: number; size?: number; delay?: number }
export function createLineTargets(x1: number, y1: number, x2: number, y2: number, spacing = 7): Target[] {
  const count = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / spacing));
  return Array.from({ length: count + 1 }, (_, i) => ({ x: x1 + (x2 - x1) * i / count, y: y1 + (y2 - y1) * i / count, opacity: .48, size: .85 }));
}
export function createRectangleTargets(x: number, y: number, width: number, height: number, spacing = 7): Target[] {
  return [...createLineTargets(x, y, x + width, y, spacing).slice(0, -1), ...createLineTargets(x + width, y, x + width, y + height, spacing).slice(0, -1), ...createLineTargets(x + width, y + height, x, y + height, spacing).slice(0, -1), ...createLineTargets(x, y + height, x, y, spacing).slice(0, -1)];
}
export function createButtonTargets(x: number, y: number, width: number, height: number) { return createRectangleTargets(x, y, width, height, 5); }
export function createIconTargets(icon: 'plus' | 'close' | 'arrow' | 'heart', x: number, y: number, size = 18): Target[] {
  const half = size / 2;
  if (icon === 'plus') return [...createLineTargets(x - half, y, x + half, y, 2), ...createLineTargets(x, y - half, x, y + half, 2)];
  if (icon === 'close') return [...createLineTargets(x - half, y - half, x + half, y + half, 2), ...createLineTargets(x + half, y - half, x - half, y + half, 2)];
  if (icon === 'arrow') return [...createLineTargets(x - half, y, x + half, y, 2), ...createLineTargets(x, y - half, x + half, y, 2), ...createLineTargets(x, y + half, x + half, y, 2)];
  return Array.from({ length: 36 }, (_, i) => { const t = i / 36 * Math.PI * 2; return { x: x + half * Math.sin(t) ** 3, y: y - size / 32 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)), size: .8 }; });
}
