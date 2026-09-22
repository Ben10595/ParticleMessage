import { Behavior, CAPACITY, COLORS, type Target } from './types';
import { seed } from '../reveal';
import { EFFECTS, type TransitionEffect } from '../../types/message';
import { matchTargets } from './matching';
export const effectId = (effect: TransitionEffect) => Math.max(0, EFFECTS.indexOf(effect as typeof EFFECTS[number]));
/** Structure of arrays: IDs and storage survive every scene. No per-frame particles are allocated. */
export class ParticlePool {
  count: number;
  x = new Float32Array(CAPACITY); y = new Float32Array(CAPACITY); z = new Float32Array(CAPACITY);
  vx = new Float32Array(CAPACITY); vy = new Float32Array(CAPACITY);
  ax = new Float32Array(CAPACITY); ay = new Float32Array(CAPACITY);
  tx = new Float32Array(CAPACITY); ty = new Float32Array(CAPACITY); tz = new Float32Array(CAPACITY);
  fx = new Float32Array(CAPACITY); fy = new Float32Array(CAPACITY);
  guideX = new Float32Array(CAPACITY); guideY = new Float32Array(CAPACITY);
  driftVX = new Float32Array(CAPACITY); driftVY = new Float32Array(CAPACITY);
  flowX = new Float32Array(CAPACITY); flowY = new Float32Array(CAPACITY);
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
    let slots = Array.from({length:budget},(_,i)=>available[Math.floor(i*available.length/budget)]);
    let targets = input.length > budget ? Array.from({ length: budget }, (_, i) => input[Math.floor(i * input.length / budget)]) : input.slice();
    if (!preserve) {
      const matched=matchTargets(slots,targets,this.x,this.y);
      slots=matched.ids;targets=matched.points;
    }
    const used = new Set(slots);
    for (const i of old) if (!used.has(i)) this.releaseSlot(i, now);
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const t of targets) { left = Math.min(left,t.x); right = Math.max(right,t.x); top = Math.min(top,t.y); bottom = Math.max(bottom,t.y); }
    const width = Math.max(1,right-left), height = Math.max(1,bottom-top);
    const spread = Math.max(24,Math.min(140,width*.24));
    slots.forEach((i, n) => {
      const t = targets[n];
      this.owner[i] = group; this.state[i] = Behavior.FORMING;
      this.fx[i] = this.x[i]; this.fy[i] = this.y[i];
      this.guideX[i] = this.x[i]; this.guideY[i] = this.y[i];
      this.driftVX[i] = this.vx[i]; this.driftVY[i] = this.vy[i];
      this.tx[i] = t.x; this.ty[i] = t.y; this.tz[i] = t.z ?? 0;
      // Neighbouring dots share a flow field sized to the text, not the viewport.
      this.flowX[i] = (t.x-(left+right)/2)/width*spread*2;
      this.flowY[i] = (t.y-(top+bottom)/2)/height*spread;
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
      this.guideX[i] += dx; this.guideY[i] += dy;
    }
  }
  countOwned() { let n = 0; for (const ids of this.groups.values()) n += ids.length; return n; }
  releaseSlot(i: number, now: number, strength = .6) {
    this.owner[i] = 0; this.state[i] = strength > 1 ? Behavior.EXPLODE : Behavior.DISPERSE;
    this.fx[i] = this.x[i]; this.fy[i] = this.y[i]; this.opacity[i] = this.alpha[i];
    this.start[i] = now;
    this.vx[i] += strength > 1 ? Math.cos(this.phase[i])*140*strength : (35+Math.sin(this.y[i]*.008)*55)*strength;
    this.vy[i] += strength > 1 ? Math.sin(this.phase[i])*140*strength : (-65+Math.cos(this.x[i]*.006)*25)*strength;
  }
  release(group: number, now: number, strength = .6) { for (const i of this.groups.get(group) ?? []) this.releaseSlot(i, now, strength); this.groups.delete(group); }
}
