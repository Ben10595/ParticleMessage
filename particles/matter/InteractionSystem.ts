export interface Pointer { x: number; y: number; vx: number; vy: number; time: number; touch: boolean }
export interface Ripple { x: number; y: number; start: number; strength: number }
/** Pointer Events support concurrent fingers; editor scrolling stays native. */
export class InteractionSystem {
  pointers = new Map<number, Pointer>();
  ripples: Ripple[] = [];
  private events = new AbortController();
  constructor(private clock: () => number) {
    const options = { signal: this.events.signal, passive: true };
    const move = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select, [role="listbox"]')) return;
      const old = this.pointers.get(e.pointerId), time = performance.now(), dt = Math.max(8, time - (old?.time ?? time));
      if (this.pointers.size >= 5 && !old) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, vx: old ? Math.max(-1200, Math.min(1200, (e.clientX - old.x) * 1000 / dt)) : 0, vy: old ? Math.max(-1200, Math.min(1200, (e.clientY - old.y) * 1000 / dt)) : 0, time, touch: e.pointerType !== 'mouse' });
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
  update(now: number) { this.ripples = this.ripples.filter(r => now - r.start < 1500); for (const p of this.pointers.values()) { p.vx *= .86; p.vy *= .86; } }
  destroy() { this.events.abort(); this.pointers.clear(); this.ripples = []; }
}
