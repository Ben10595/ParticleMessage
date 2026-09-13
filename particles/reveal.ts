import type { TransitionEffect } from '../types/message';
import { clamp, ease, type Point } from '../lines/geometry';
export const seed = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** Continuous paths share exact endpoints; no residual motion can blur held text. */
export function revealPoint(from: Point, to: Point, progress: number, effect: TransitionEffect, index: number, width: number, height: number): Point {
  const t = clamp(progress), e = ease(t), arc = Math.sin(Math.PI * t) * (1 - t), angle = seed(index) * Math.PI * 2;
  let x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e;
  const distance = Math.min(width, height) * .4;
  switch (effect) {
    case 'explosion': case 'outward': x += Math.cos(angle) * distance * arc * 2; y += Math.sin(angle) * distance * arc * 2; break;
    case 'spiral': x += Math.cos(angle + t * Math.PI * 4) * distance * arc; y += Math.sin(angle + t * Math.PI * 4) * distance * arc; break;
    case 'vortex': x -= (to.y - height / 2) * arc * 2; y += (to.x - width / 2) * arc * 2; break;
    case 'magnet': x += Math.sin(t * Math.PI * 3) * (to.x - from.x) * (1 - t) * .24; y += Math.sin(t * Math.PI * 3) * (to.y - from.y) * (1 - t) * .24; break;
    case 'wave': y += Math.sin(to.x / width * Math.PI * 3 - t * Math.PI * 2) * arc * 95; break;
    case 'rain': y -= height * arc * .65; break;
    case 'zoom': case 'implode': x += (to.x - width / 2) * arc * 2.8; y += (to.y - height / 2) * arc * 2.8; break;
    case 'rise': y += height * arc * .35; break;
    case 'bloom': x += Math.cos(angle) * arc * 45; y += Math.sin(angle) * arc * 45; break;
    case 'collect': case 'scatter': x += Math.cos(angle) * arc * 90; y += Math.sin(angle) * arc * 90; break;
  }
  return { x, y };
}
export function advanceHold(progress: number, pressed: boolean, elapsed: number, reduced = false) {
  if (progress >= 1) return 1;
  if (reduced && pressed) return 1;
  return clamp(progress + elapsed / (pressed ? 2600 : -5200));
}
