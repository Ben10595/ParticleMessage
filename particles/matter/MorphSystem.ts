import { Behavior, CAPACITY, COLORS, type Target } from './types';
import { seed } from '../reveal';
import { EFFECTS, type TransitionEffect } from '../../types/message';
export const effectId = (effect: TransitionEffect) => Math.max(0, EFFECTS.indexOf(effect as typeof EFFECTS[number]));
/** Structure of arrays: IDs and storage survive every scene. No per-frame particles are allocated. */
export class ParticlePool {
  count: number;
  x = new Float32Array(CAPACITY); y = new Float32Array(CAPACITY); z = new Float32Array(CAPACITY);
  vx = new Float32Array(CAPACITY); vy = new Float32Array(CAPACITY);
  ax = new Float32Array(CAPACITY); ay = new Float32Array(CAPACITY);
  tx = new Float32Array(CAPACITY); ty = new Float32Array(CAPACITY); tz = new Float32Array(CAPACITY);
  fx = new Float32Array(CAPACITY); fy = new Float32Array(CAPACITY);
  radius = new Float32Array(CAPACITY); alpha = new Float32Array(CAPACITY); opacity = new Float32Array(CAPACITY);
  start = new Float32Array(CAPACITY); duration = new Float32Array(CAPACITY); delay = new Float32Array(CAPACITY);
  phase = new Float32Array(CAPACITY); random = new Float32Array(CAPACITY);
  color = new Float32Array(CAPACITY * 3);
  state = new Uint8Array(CAPACITY); effect = new Uint8Array(CAPACITY); part = new Uint8Array(CAPACITY);
  uiElement = new Uint16Array(CAPACITY);
  owner = new Int32Array(CAPACITY); glyph = new Int32Array(CAPACITY);
  groups = new Map<number, number[]>();
  constructor(count: number, width: number, height: number) {
    this.count = Math.min(CAPACITY, count);
    for (let i = 0; i < CAPACITY; i++) {
      this.random[i] = seed(i + 7); this.phase[i] = seed(i + 21) * Math.PI * 2;
      this.x[i] = seed(i + 8) * width; this.y[i] = seed(i + 82) * height;
      this.tx[i] = this.x[i]; this.ty[i] = this.y[i]; this.z[i] = seed(i + 91) * 100 - 50;
      this.radius[i] = .45 + seed(i) * .8; this.alpha[i] = 0;
      this.color.set(i % 7 === 0 ? COLORS.gold : i % 11 === 0 ? COLORS.violet : COLORS.ivory, i * 3);
    }
  }
  form(group: number, input: Target[], now: number, duration: number, effect: TransitionEffect, preserve = false): number[] {
    const old = this.groups.get(group) ?? [];
    const available = old.slice();
    const budget = Math.min(input.length, this.count - (this.countOwned() - old.length));
    for (let i = 0; available.length < budget && i < this.count; i++) if (!this.owner[i]) available.push(i);
    const slots = available.slice(0, budget);
    const targets = input.length > budget ? Array.from({ length: budget }, (_, i) => input[Math.floor(i * input.length / budget)]) : input.slice();
    // Spatial ordering avoids quadratic nearest-neighbor matching and long, chaotic crossings.
    // A serpentine grid key provides local correspondence in O(n log n).
    const key = (x: number, y: number) => { const row = Math.floor(y / 24); return row * 100000 + (row % 2 ? -x : x); };
    if (!preserve) {
      slots.sort((a, b) => key(this.x[a], this.y[a]) - key(this.x[b], this.y[b]));
      targets.sort((a, b) => key(a.x, a.y) - key(b.x, b.y));
    }
    const used = new Set(slots);
    for (const i of old) if (!used.has(i)) this.releaseSlot(i, now);
    slots.forEach((i, n) => {
      const t = targets[n];
      this.owner[i] = group; this.state[i] = Behavior.FORMING;
      this.fx[i] = this.x[i]; this.fy[i] = this.y[i];
      this.tx[i] = t.x; this.ty[i] = t.y; this.tz[i] = t.z ?? 0;
      this.radius[i] = t.radius ?? 1; this.opacity[i] = t.alpha ?? .92;
      this.color.set(t.color ?? COLORS.ivory, i * 3);
      this.glyph[i] = t.glyph ?? -1; this.part[i] = t.part ?? 0; this.uiElement[i] = t.uiElement ?? 0;
      this.start[i] = now; this.delay[i] = t.delay ?? 0; this.duration[i] = duration;
      this.effect[i] = effectId(effect);
    });
    this.groups.set(group, slots); return slots;
  }
  /** Scroll translates the whole trajectory; IDs, velocities and reveal clocks stay intact. */
  translate(slots: number[], dx: number, dy: number) {
    if (!dx && !dy) return;
    for (const i of slots) {
      this.x[i] += dx; this.y[i] += dy;
      this.tx[i] += dx; this.ty[i] += dy;
      this.fx[i] += dx; this.fy[i] += dy;
    }
  }
  countOwned() { let n = 0; for (const ids of this.groups.values()) n += ids.length; return n; }
  releaseSlot(i: number, now: number, strength = .6) {
    this.owner[i] = 0; this.state[i] = strength > 1 ? Behavior.EXPLODE : Behavior.DISPERSE;
    this.start[i] = now; this.vx[i] += Math.cos(this.phase[i]) * 140 * strength; this.vy[i] += Math.sin(this.phase[i]) * 140 * strength;
  }
  release(group: number, now: number, strength = .6) { for (const i of this.groups.get(group) ?? []) this.releaseSlot(i, now, strength); this.groups.delete(group); }
}
