import { clamp } from '../lines/geometry';
export const seed = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export function advanceHold(progress: number, pressed: boolean, elapsed: number, reduced = false) {
  if (progress >= 1) return 1;
  if (reduced && pressed) return 1;
  return clamp(progress + elapsed / (pressed ? 2600 : -5200));
}
