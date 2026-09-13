import { clamp, contour, measure, pointAt, type Point } from '../lines/geometry';
import type { LineLayout } from '../lines/lineFont';
import type { TransitionEffect } from '../types/message';
import type { Finale, GiftStyle, Secret } from '../types/experience';
import { advanceHold, revealPoint, seed } from './reveal';
export interface DotTarget extends Point { glyph: number; part?: 'lid'; radius: number; delay?: number }
interface Dot extends DotTarget { from: Point; current: Point; start: number; duration: number; effect: TransitionEffect; fromOpacity?: number; currentOpacity?: number }
export interface SecretBounds { x: number; y: number; width: number; height: number; secret: number }
const rasterCache = new Map<string, Point[]>();
function rasterGlyph(char: string): Point[] {
  if (rasterCache.has(char)) return rasterCache.get(char)!;
  const points: Point[] = [];
  if (typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 110;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.font = '80px -apple-system, sans-serif'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff'; ctx.fillText(char, 0, 0);
      const pixels = ctx.getImageData(0, 0, 110, 110).data;
      for (let y = 0; y < 110; y += 3) for (let x = 0; x < 110; x += 3) if (pixels[(y * 110 + x) * 4 + 3] > 90) points.push({ x: x / 80, y: y / 80 });
    }
  }
  if (rasterCache.size > 160) rasterCache.delete(rasterCache.keys().next().value!);
  rasterCache.set(char, points); return points;
}
export function samplePaths(paths: Point[][], glyph = -1, radius = .9, part?: 'lid'): DotTarget[] {
  const result: DotTarget[] = [];
  for (const path of paths) {
    const m = measure(path), count = Math.max(1, Math.ceil(m.length / (radius * 2.85)));
    for (let i = 0; i <= count; i++) result.push({ ...pointAt(path, m.lengths, m.length * i / count), glyph, radius, part });
  }
  return result;
}
export function sampleLayout(layout: LineLayout): DotTarget[] {
  return layout.glyphs.flatMap(g => g.fallback
    ? rasterGlyph(g.char).map(p => ({ x: g.x + p.x * layout.fontSize, y: g.y + p.y * layout.fontSize, glyph: g.index, radius: Math.max(.65, layout.fontSize / 65) }))
    : samplePaths(g.paths, g.index, Math.max(.72, Math.min(1.35, layout.fontSize / 53))));
}
export function secretBounds(layout: LineLayout, text: string, secrets: Secret[]): SecretBounds[] {
  const offsets: number[] = []; let offset = 0;
  for (const g of layout.glyphs) { offsets[g.index] = offset; offset += g.char.length; }
  return secrets.flatMap((s, secret) => {
    const rows = new Map<number, typeof layout.glyphs>();
    for (const g of layout.glyphs) if (offsets[g.index] >= s.start && offsets[g.index] < s.end && text.slice(s.start, s.end).trim()) {
      const row = rows.get(g.y) ?? []; row.push(g); rows.set(g.y, row);
    }
    return [...rows.values()].map(row => ({ secret, x: row[0].x - 5, y: row[0].y - 5, width: row.at(-1)!.x + row.at(-1)!.width - row[0].x + 10, height: Math.max(44, layout.fontSize * 1.25) }));
  });
}
export function shapeTargets(shape: Finale['shape'] | 'gift', width: number, height: number): DotTarget[] {
  const cx = width / 2, cy = height * .45, size = Math.min(width * .25, height * .22, 155);
  if (shape === 'gift') {
    const w = size * 1.25, h = size;
    const box = samplePaths([contour(cx - w / 2, cy - h * .35, w, h, 2), [{ x: cx, y: cy - h * .35 }, { x: cx, y: cy + h * .65 }]], -1, 1.05);
    const lid = samplePaths([contour(cx - w * .57, cy - h * .55, w * 1.14, h * .2, 2), ...[-1, 1].map(sign => Array.from({ length: 50 }, (_, i) => { const a = i / 49 * Math.PI * 2; return { x: cx + sign * w * .19 * (1 - Math.cos(a)), y: cy - h * .55 - Math.sin(a) * h * .2 - h * .15 }; }))], -1, 1.05, 'lid');
    return [...box, ...lid];
  }
  const path = Array.from({ length: 241 }, (_, i) => {
    const a = i / 240 * Math.PI * 2;
    if (shape === 'heart') return { x: cx + size * Math.sin(a) ** 3, y: cy - size * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16 };
    if (shape === 'infinity') return { x: cx + size * Math.cos(a) / (1 + Math.sin(a) ** 2), y: cy + size * Math.cos(a) * Math.sin(a) / (1 + Math.sin(a) ** 2) };
    const n = i / 240 * 10, j = Math.floor(n), t = n - j;
    const vertex = (k: number) => ({ x: cx + Math.sin(k * Math.PI / 5) * size * (k % 2 ? .44 : 1), y: cy - Math.cos(k * Math.PI / 5) * size * (k % 2 ? .44 : 1) });
    const p = vertex(j), q = vertex(j + 1); return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
  });
  return samplePaths([path], -1, 1.2);
}
/** One bounded pool, owned by the existing canvas RAF. Geometry is sampled only on layout changes. */
export class SceneParticles {
  private dots: Dot[] = [];
  private retiring: Dot[] = [];
  private releaseAt: number | null = null;
  private giftAt: number | null = null;
  private giftStyle: GiftStyle = 'ribbon';
  private floating = false;
  private hold: { progress: number; pressed: boolean } | null = null;
  private tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };
  get dispersing() { return this.releaseAt !== null; }
  get count() { return this.dots.length; }
  get holdProgress() { return this.hold?.progress ?? 1; }
  setPressed(pressed: boolean, reduced = false) { if (this.hold) { this.hold.pressed = pressed; if (pressed && reduced) this.hold.progress = 1; } }
  setTilt(x: number, y: number) { this.tilt.targetX = Math.max(-1, Math.min(1, x)); this.tilt.targetY = Math.max(-1, Math.min(1, y)); }
  form(targets: DotTarget[], now: number, effect: TransitionEffect, duration: number, width: number, height: number, hold = false, refresh = false) {
    const budget = width < 700 ? 4200 : 7000;
    const stride = Math.max(1, Math.ceil(targets.length / budget));
    if (!refresh) { this.releaseAt = null; this.giftAt = null; this.floating = false; this.hold = hold ? { progress: 0, pressed: false } : null; }
    const previous = this.dots;
    this.dots = targets.filter((_, i) => i % stride === 0).map((target, i) => {
      const old = previous[i], from = old?.current ?? (effect === 'fade' ? target : { x: seed(i + 2) * width, y: seed(i + 99) * height });
      return { ...target, fromOpacity: refresh && old ? old.fromOpacity : old?.currentOpacity ?? .08, from: refresh && old ? old.from : { ...from }, current: old?.current ?? { ...from }, start: refresh && old ? old.start : now, duration, effect };
    });
    if (!refresh) this.retiring = previous.slice(this.dots.length).map(dot => ({ ...dot, from: { ...dot.current }, x: dot.current.x + (seed(dot.x) - .5) * 120, y: dot.current.y + (seed(dot.y) - .5) * 120, start: now, duration: 650, delay: 0 }));
  }
  revealSubset(selected: Set<number>, targets: DotTarget[], now: number) {
    this.hold = null;
    const source = this.dots.filter(dot => selected.has(dot.glyph));
    const fixed = this.dots.filter(dot => !selected.has(dot.glyph)).map(dot => ({ ...dot, from: { ...dot.current }, start: now, duration: 0, delay: 0, effect: 'fade' as const }));
    this.dots = [...fixed, ...targets.map((target, i): Dot => ({ ...target, glyph: -2, from: { ...(source[i % source.length]?.current ?? target) }, current: { ...(source[i % source.length]?.current ?? target) }, start: now, duration: 700, effect: 'collect' }))];
  }
  restoreSubset(targets: DotTarget[], now: number) {
    const secret = this.dots.filter(dot => dot.glyph === -2);
    const fixed = new Map<string, Dot>();
    for (const dot of this.dots) if (dot.glyph !== -2) fixed.set(`${dot.glyph}/${dot.x}/${dot.y}`, dot);
    this.dots = targets.map((target, i): Dot => {
      const old = fixed.get(`${target.glyph}/${target.x}/${target.y}`), from = old?.current ?? secret[i % secret.length]?.current ?? target;
      return { ...target, from: { ...from }, current: { ...from }, start: now, duration: old ? 0 : 700, effect: old ? 'fade' : 'magnet' };
    });
  }
  openGift(now: number, style: GiftStyle) { this.giftAt = now; this.giftStyle = style; }
  float() { this.floating = true; }
  disperse(now: number, width: number, height: number, strength = 1) {
    this.hold = null; this.giftAt = null; this.releaseAt = now; this.retiring = [];
    this.dots.forEach((dot, i) => { dot.from = { ...dot.current }; dot.x = dot.current.x + (seed(i) - .5) * width * strength; dot.y = dot.current.y + (seed(i + 30) - .5) * height * strength; dot.start = now; dot.delay = 0; dot.duration = 1200; dot.effect = 'scatter'; });
  }
  clear() { this.dots = []; this.retiring = []; this.hold = null; this.releaseAt = null; }
  draw(ctx: CanvasRenderingContext2D, now: number, elapsed: number, width: number, height: number, reduced: boolean) {
    if (this.hold) this.hold.progress = advanceHold(this.hold.progress, this.hold.pressed, elapsed, reduced);
    const smoothing = 1 - Math.exp(-elapsed / 160);
    this.tilt.x += (this.tilt.targetX - this.tilt.x) * smoothing; this.tilt.y += (this.tilt.targetY - this.tilt.y) * smoothing;
    ctx.fillStyle = '#f4f4ee';
    if (this.giftAt !== null && !reduced) { ctx.shadowColor = '#edf5d3'; ctx.shadowBlur = 8 * Math.sin(clamp((now - this.giftAt) / 850) * Math.PI); }
    // Four alpha buckets avoid a fill call or a glow filter per particle.
    for (let bucket = 0; bucket < 4; bucket++) {
      ctx.beginPath(); ctx.globalAlpha = (bucket + 1) / 4;
      const draw = (dot: Dot, i: number, retiring: boolean) => {
        const t = this.hold ? this.hold.progress : reduced ? 1 : clamp((now - dot.start - (dot.delay ?? 0)) / Math.max(1, dot.duration));
        let alpha = retiring ? 1 - t : this.releaseAt !== null ? 1 - t : (dot.fromOpacity ?? .08) + (1 - (dot.fromOpacity ?? .08)) * t;
        if (reduced && this.releaseAt !== null) alpha = 0;
        if (alpha <= 0 || Math.min(3, Math.floor(alpha * 4)) !== bucket) return;
        const p = revealPoint(dot.from, dot, t, dot.effect, i, width, height);
        if (this.giftAt !== null && !reduced) {
          const opening = clamp((now - this.giftAt) / 850);
          if (dot.part === 'lid') { p.y -= Math.sin(opening * Math.PI / 2) * 85; p.x += Math.sin(opening * Math.PI) * 25; }
          if (this.giftStyle === 'orbit') { p.x += Math.sin(opening * Math.PI * 2) * opening * 40; p.y += Math.cos(opening * Math.PI * 2) * opening * 20; }
        }
        if (!reduced) {
          const drift = this.floating ? 1.2 : 0;
          p.x += Math.sin(now * .0006 + i * .07) * drift + this.tilt.x * (t >= 1 ? .65 : 9);
          p.y += Math.cos(now * .0005 + i * .07) * drift + this.tilt.y * (t >= 1 ? .65 : 9);
        }
        dot.current = p; dot.currentOpacity = alpha;
        const glow = this.giftAt === null || reduced ? 1 : 1 + Math.sin(clamp((now - this.giftAt) / 850) * Math.PI) * .8;
        const radius = dot.radius * glow;
        ctx.moveTo(p.x + radius, p.y); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      };
      this.dots.forEach((dot, i) => draw(dot, i, false)); this.retiring.forEach((dot, i) => draw(dot, i, true)); ctx.fill();
    }
    this.retiring = this.retiring.filter(dot => now < dot.start + dot.duration);
    if (this.releaseAt !== null && (reduced || now - this.releaseAt >= 1200)) this.clear();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
}
