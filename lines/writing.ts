import type { TransitionEffect } from '../types/message';
import { measure, type Point } from './geometry';

export function entranceDuration(effect?: TransitionEffect) {
  return !effect || effect === 'morph' || effect === 'typewriter' ? 0 : 460;
}

/** Glyph-local motion settles exactly, keeping all strokes of a letter together.
 * Offsets are in em units, so preview and full-screen playback look alike. */
export function entranceFrame(effect: TransitionEffect | undefined, progress: number, seed = 0) {
  const t = Math.max(0, Math.min(1, progress)), rest = (1 - t) ** 3;
  const frame = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
  if (t === 1) return frame;
  if (effect === 'fade') frame.opacity = t * t * (3 - 2 * t);
  if (effect === 'rise') { frame.y = .42 * rest; frame.opacity = 1 - rest; }
  if (effect === 'bloom') { frame.scale = 1 - .8 * rest + Math.sin(t * Math.PI) * .08; frame.opacity = 1 - rest; }
  if (effect === 'wave') frame.y = Math.sin(t * Math.PI * 2 + seed * .65) * .28 * rest;
  if (effect === 'rain') { frame.y = -.65 * rest; frame.opacity = 1 - rest; }
  if (effect === 'vortex') { frame.rotation = -.8 * rest; frame.x = -.18 * rest; frame.y = .2 * rest; }
  if (effect === 'implode') { frame.scale = 1 + .65 * rest; frame.opacity = 1 - rest; }
  if (effect === 'scatter' || effect === 'explosion' || effect === 'outward') {
    frame.x = Math.sin(seed * 2.4 + .7) * .48 * rest;
    frame.y = Math.cos(seed * 1.7 + .3) * .48 * rest;
    frame.rotation = Math.sin(seed * 3 + 1) * .32 * rest; frame.opacity = 1 - rest;
  }
  return frame;
}

/** Give each pen stroke its own turn, weighted by travelled distance. Short
 * pen lifts leave a letter's crossbars and dots separate without stray ink. */
export function scheduleStrokes(paths: Point[][], duration: number) {
  if (!paths.length) return [];
  const lengths = paths.map(path => measure(path).length);
  const total = lengths.reduce((sum, length) => sum + length, 0) || 1;
  const lift = paths.length > 1 ? Math.min(10, duration * .08 / (paths.length - 1)) : 0;
  const inkTime = Math.max(0, duration - lift * (paths.length - 1));
  const minimum = inkTime * .12 / paths.length;
  const remaining = inkTime - minimum * paths.length;
  let offset = 0;
  return lengths.map(length => {
    const strokeDuration = minimum + remaining * length / total;
    const stroke = { offset, duration: strokeDuration };
    offset += strokeDuration + lift;
    return stroke;
  });
}

/** Mostly constant pen speed, with a small ease at lift-off and landing. */
export function inkProgress(progress: number, effect?: TransitionEffect) {
  const t = Math.max(0, Math.min(1, progress));
  if (t === 0 || t === 1) return t;
  // Existing effects now shape the pen's cadence instead of a background wire.
  if (effect === 'wave') return t + .035 * Math.sin(t * Math.PI * 2);
  if (effect === 'vortex') return t + .025 * Math.sin(t * Math.PI * 4);
  if (effect === 'rain') return 1 - Math.cos(t * Math.PI / 2);
  if (effect === 'implode') return Math.sin(t * Math.PI / 2);
  if (effect === 'scatter' || effect === 'explosion' || effect === 'outward') return t + .02 * Math.sin(t * Math.PI * 6);
  return .82 * t + .18 * t * t * (3 - 2 * t);
}
