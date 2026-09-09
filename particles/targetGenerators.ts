export interface Target { key?: string; glyph?: number; x: number; y: number; opacity?: number; size?: number; delay?: number }
export function createLineTargets(x1: number, y1: number, x2: number, y2: number, spacing = 7): Target[] {
  const count = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / spacing));
  return Array.from({ length: count + 1 }, (_, i) => ({ x: x1 + (x2 - x1) * i / count, y: y1 + (y2 - y1) * i / count, opacity: .48, size: .85 }));
}
export function createRectangleTargets(x: number, y: number, width: number, height: number, spacing = 7): Target[] {
  return [...createLineTargets(x, y, x + width, y, spacing), ...createLineTargets(x + width, y, x + width, y + height, spacing), ...createLineTargets(x + width, y + height, x, y + height, spacing), ...createLineTargets(x, y + height, x, y, spacing)];
}
export function createButtonTargets(x: number, y: number, width: number, height: number) { return createRectangleTargets(x, y, width, height, 5); }
