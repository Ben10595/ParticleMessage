import { response } from './motion';
import type { Box } from './types';
export interface Pointer { x: number; y: number; vx: number; vy: number; time: number; touch: boolean }
export interface Ripple { x: number; y: number; start: number; strength: number }
export interface HoverWave extends Box { start: number }
/** Pointer Events support concurrent fingers; editor scrolling stays native. */
export class InteractionSystem {
  pointers = new Map<number, Pointer>();
  ripples: Ripple[] = [];
  hoverWaves: HoverWave[] = [];
  private events = new AbortController();
  constructor(private clock: () => number) {
    const options = { signal: this.events.signal, passive: true };
    const move = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select, [role="listbox"]')) { this.pointers.delete(e.pointerId); return; }
      const old = this.pointers.get(e.pointerId), time = performance.now(), dt = Math.max(8, time - (old?.time ?? time));
      if (this.pointers.size >= 5 && !old) return;
      const blend = response(dt, 24);
      const velocity = (distance: number, previous: number) => previous + (Math.max(-1200, Math.min(1200, distance * 1000 / dt)) - previous) * blend;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, vx: old ? velocity(e.clientX - old.x, old.vx) : 0, vy: old ? velocity(e.clientY - old.y, old.vy) : 0, time, touch: e.pointerType !== 'mouse' });
    };
    window.addEventListener('pointermove', move, options);
    window.addEventListener('pointerdown', e => { move(e); if (e.button === 0 && !(e.target as HTMLElement)?.closest('input, textarea, select')) this.ripple(e.clientX, e.clientY, .6); }, options);
    const up = (e: PointerEvent) => { if (e.pointerType !== 'mouse' || e.type !== 'pointerup') this.pointers.delete(e.pointerId); };
    window.addEventListener('pointerup', up, options); window.addEventListener('pointercancel', up, options);
    document.addEventListener('pointerleave', up, options);
    window.addEventListener('blur', () => this.pointers.clear(), options);
    document.addEventListener('visibilitychange', () => this.pointers.clear(), options);
  }
  ripple(x: number, y: number, strength = 1) { if (this.ripples.length >= 5) this.ripples.shift(); this.ripples.push({ x, y, start: this.clock(), strength }); }
  hover(rect: Box) {
    if (this.hoverWaves.length >= 6) this.hoverWaves.shift();
    this.hoverWaves.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, start: this.clock() });
  }
  update(now: number, elapsed: number) {
    this.ripples = this.ripples.filter(r => now - r.start < 1500);
    this.hoverWaves = this.hoverWaves.filter(w => now - w.start < 720);
    const damping = 1 - response(elapsed, 9);
    for (const p of this.pointers.values()) { p.vx *= damping; p.vy *= damping; }
  }
  destroy() { this.events.abort(); this.pointers.clear(); this.ripples = []; this.hoverWaves = []; }
}
