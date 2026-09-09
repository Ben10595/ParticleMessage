import { createTextLayout, type TextLayout, type TextOptions } from './textSampler';
import type { Target } from './targetGenerators';
import { EFFECTS, type TransitionEffect, type WritingSettings } from '../types/message';
import { typingTimeline } from '../lib/playback';
export type ParticleState = 'FLOATING' | 'FORMING' | 'HOLDING' | 'DISPERSING';
export interface Particle {
  x: number; y: number; targetX: number; targetY: number; velocityX: number; velocityY: number;
  size: number; opacity: number; idleOffset: number; phase: number; speed: number; spring: number;
  state: ParticleState; activation: number; release: number; targetOpacity: number; targetSize: number;
  fromX: number; fromY: number; controlX: number; controlY: number; duration: number; homeX: number; homeY: number;
}
interface Presentation { layout: TextLayout; timeline: number[]; start: number; typing: boolean; cursorUntil: number }
export interface FormOptions { bounds?: () => DOMRect; writing?: WritingSettings; effect?: TransitionEffect; finale?: boolean }
export class ParticleEngine {
  readonly particles: Particle[] = [];
  width = 0; height = 0; time = 0; reducedMotion = false;
  private ctx: CanvasRenderingContext2D;
  private frame = 0; private lastFrame = 0; private disposed = false;
  private pointer = { x: -1000, y: -1000 };
  private scene: (() => void) | null = null;
  private assignments = new Map<string, Particle>();
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  private slowFrames = 0; private frameCount = 0; private performanceScale = 1;
  private presentation: Presentation | null = null;
  private uiLayouts: TextLayout[] = [];
  private waiters = new Set<{ end: number; finish: () => void; abort: () => void }>();
  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas wird von deinem Browser nicht unterstützt.');
    this.ctx = ctx; this.reducedMotion = this.motion.matches; this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('scroll', this.refresh, { passive: true });
    window.addEventListener('pointermove', this.move, { passive: true });
    window.addEventListener('pointerout', this.leave);
    document.addEventListener('visibilitychange', this.visibility);
    this.motion.addEventListener('change', this.changeMotion);
    this.frame = requestAnimationFrame(this.tick);
  }
  private changeMotion = () => { this.reducedMotion = this.motion.matches; this.refresh(); };
  private visibility = () => { this.lastFrame = 0; };
  private move = (event: PointerEvent) => { this.pointer.x = event.clientX; this.pointer.y = event.clientY; };
  private leave = () => { this.pointer.x = -1000; this.pointer.y = -1000; };
  private makeParticle(): Particle {
    const x = Math.random() * this.width, y = Math.random() * this.height;
    return { x, y, homeX: x, homeY: y, targetX: 0, targetY: 0, velocityX: 0, velocityY: 0,
      size: .55 + Math.random() * .55, opacity: .08, idleOffset: Math.random() * Math.PI * 2,
      phase: Math.random() * 10, speed: .4 + Math.random() * .6, spring: .03,
      state: 'FLOATING', activation: 0, release: 0, targetOpacity: 1, targetSize: 1,
      fromX: x, fromY: y, controlX: x, controlY: y, duration: 1000 };
  }
  private desiredCount() { return Math.round(Math.min(this.width < 700 ? 140 : 300, this.width * this.height / 4500) * this.performanceScale); }
  private resize = () => {
    this.width = window.innerWidth; this.height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * dpr); this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    while (this.particles.length < this.desiredCount()) this.particles.push(this.makeParticle());
    this.refresh();
  };
  refresh = () => { if (!this.disposed) this.scene?.(); };
  setParticleTargets(targets: Target[], animate = true, effect: TransitionEffect = 'morph', duration = 1150) {
    if (effect === 'random') effect = EFFECTS[Math.floor(Math.random() * (EFFECTS.length - 1))];
    while (this.particles.length < targets.length + this.desiredCount()) this.particles.push(this.makeParticle());
    const available = new Set(this.particles);
    const next = new Map<string, Particle>();
    for (let i = 0; i < targets.length; i++) {
      const key = targets[i].key ?? `point-${i}`, existing = this.assignments.get(key);
      if (existing && available.delete(existing)) next.set(key, existing);
    }
    // Spatial buckets assign unclaimed particles close to their next glyph, in linear time.
    const buckets = new Map<string, Particle[]>();
    available.forEach(p => {
      const key = `${Math.floor(p.x / 64)},${Math.floor(p.y / 64)}`;
      const bucket = buckets.get(key) ?? []; bucket.push(p); buckets.set(key, bucket);
    });
    targets.forEach((target, index) => {
      const key = target.key ?? `point-${index}`;
      let p = next.get(key);
      if (!p) {
        const gx = Math.floor(target.x / 64), gy = Math.floor(target.y / 64);
        for (let ring = 0; ring <= 2 && !p; ring++) for (let dy = -ring; dy <= ring && !p; dy++) for (let dx = -ring; dx <= ring && !p; dx++) {
          const bucket = buckets.get(`${gx + dx},${gy + dy}`);
          while (bucket?.length && !p) { const candidate = bucket.pop()!; if (available.has(candidate)) p = candidate; }
        }
        p ??= available.values().next().value!;
        available.delete(p); next.set(key, p);
      }
      const unchanged = p.targetX === target.x && p.targetY === target.y && p.state === 'HOLDING';
      p.targetX = target.x; p.targetY = target.y; p.targetOpacity = target.opacity ?? 1; p.targetSize = target.size ?? 1;
      if (unchanged && !animate) return;
      p.fromX = p.x; p.fromY = p.y;
      const dx = target.x - p.x, dy = target.y - p.y;
      const bend = Math.sin(p.phase) * Math.min(25, Math.hypot(dx, dy) * .09);
      p.controlX = (p.x + target.x) / 2 + bend; p.controlY = (p.y + target.y) / 2 - bend;
      const cx = this.width / 2, cy = this.height / 2;
      if (effect === 'scatter') { p.controlX += Math.cos(p.phase) * 130; p.controlY += Math.sin(p.phase) * 130; }
      if (effect === 'explosion') { p.controlX += (p.x - cx) * 1.5; p.controlY += (p.y - cy) * 1.5; }
      if (effect === 'vortex') { p.controlX = cx - (p.y - cy) * 1.5; p.controlY = cy + (p.x - cx) * 1.5; }
      if (effect === 'wave') p.controlY += Math.sin(target.x / this.width * Math.PI * 2) * 160;
      if (effect === 'rain') p.controlY = -this.height * .5;
      if (effect === 'outward') { p.controlX = cx + (p.x - cx) * 2.5; p.controlY = cy + (p.y - cy) * 2.5; }
      if (effect === 'implode') { p.controlX = cx; p.controlY = cy; }
      p.activation = this.time + (this.reducedMotion ? 0 : target.delay ?? 0);
      p.duration = duration; p.state = 'FORMING'; p.velocityX = 0; p.velocityY = 0;
      if (this.reducedMotion || !animate) { p.state = 'HOLDING'; p.x = target.x; p.y = target.y; p.opacity = p.targetOpacity; }
    });
    available.forEach(p => { if (p.state === 'FORMING' || p.state === 'HOLDING') this.releaseParticle(p); });
    this.assignments = next;
    this.canvas.dataset.particleCount = String(this.particles.length);
    this.canvas.dataset.targetCount = String(targets.length);
    this.canvas.dataset.phase = this.reducedMotion ? 'holding' : 'forming';
  }
  private releaseParticle(p: Particle, strength = 1) {
    p.state = 'DISPERSING'; p.release = this.time + 900;
    p.velocityX = Math.cos(p.phase) * (1.5 + p.speed) * strength;
    p.velocityY = Math.sin(p.phase) * (1.5 + p.speed) * strength;
    if (this.reducedMotion) { p.state = 'FLOATING'; p.opacity = 0; }
  }
  disperseParticles(strength = 1) {
    this.scene = null; this.presentation = null; this.uiLayouts = []; this.assignments.clear();
    this.canvas.dataset.phase = 'dispersing';
    this.particles.forEach(p => { if (p.state !== 'FLOATING') this.releaseParticle(p, strength); });
  }
  formText(text: string, options: FormOptions | boolean = {}): number {
    const opts = typeof options === 'boolean' ? {} : options;
    const start = this.time;
    const timeline = opts.writing?.enabled && !this.reducedMotion ? typingTimeline(text, opts.writing) : [];
    const duration = this.reducedMotion ? 0 : timeline.length ? (opts.finale ? 850 : 430) : opts.finale ? 2000 : 1150;
    const completion = (timeline.at(-1) ?? 0) + duration;
    const form = (refresh = false) => {
      const rect = opts.bounds?.();
      const width = rect?.width ?? this.width * .84, height = rect?.height ?? this.height * .64;
      const layout = createTextLayout(text, { x: rect?.x ?? this.width * .08, y: rect?.y ?? this.height * .18, width, height, fontSize: Math.min(rect ? 64 : 104, width / (rect ? 8 : 9)), fit: true, weight: 600 });
      this.uiLayouts = [];
      this.presentation = { layout, timeline, start, typing: timeline.length > 0, cursorUntil: start + completion + 1100 };
      const elapsed = this.time - start;
      this.setParticleTargets(layout.targets.map(p => ({ ...p, delay: Math.max(0, (timeline[p.glyph ?? 0] ?? 0) - elapsed) })), !refresh, opts.effect, duration);
      // Resize preserves the writing timeline and never reveals future letters early.
      if (refresh && timeline.length && !this.reducedMotion) for (const [key, p] of this.assignments) {
        const glyph = Number(key.split('-')[1]);
        if ((timeline[glyph] ?? 0) > elapsed) { p.state = 'FORMING'; p.activation = start + timeline[glyph]; p.opacity = 0; }
      }
    };
    this.scene = () => form(true); form();
    return completion;
  }
  formUI(root: HTMLElement, animate = true) {
    const form = (refresh = false) => {
      this.presentation = null; this.uiLayouts = [];
      const targets: Target[] = [];
      root.querySelectorAll<HTMLElement>('[data-particle="hero"]').forEach((element, index) => {
        const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
        if (!rect.width || !rect.height) return;
        const options: TextOptions = { x: rect.x, y: rect.y, width: rect.width, height: rect.height, fontSize: parseFloat(style.fontSize), weight: 600, fit: true };
        const layout = createTextLayout(element.textContent ?? '', options);
        this.uiLayouts.push(layout);
        targets.push(...layout.targets.map(p => ({ ...p, key: `ui-${index}-${p.key}` })));
      });
      this.setParticleTargets(targets, animate && !refresh);
    };
    this.scene = () => form(true); form();
  }
  wait(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted || this.disposed) { reject(new DOMException('Aborted', 'AbortError')); return; }
      const cleanup = () => signal?.removeEventListener('abort', abort);
      const waiter = { end: this.time + ms, finish: () => { cleanup(); resolve(); }, abort: () => abort() };
      const abort = () => { this.waiters.delete(waiter); cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
      signal?.addEventListener('abort', abort, { once: true }); this.waiters.add(waiter);
    });
  }
  private drawEmoji(layout: TextLayout, timeline: number[] = [], start = 0) {
    this.ctx.font = `${layout.fontSize}px Arial, sans-serif`; this.ctx.textBaseline = 'middle';
    for (const glyph of layout.glyphs) {
      if (!glyph.emoji) continue;
      const age = this.time - start - (timeline[glyph.index] ?? 0);
      if (age < 0) continue;
      this.ctx.globalAlpha = this.reducedMotion ? 1 : Math.min(1, age / 300);
      this.ctx.fillText(glyph.text, glyph.x, glyph.y);
    }
  }
  private tick = (now: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
    if (document.hidden) { this.lastFrame = 0; return; }
    const elapsed = this.lastFrame ? now - this.lastFrame : 16.67; this.lastFrame = now;
    const dt = Math.min(elapsed / 16.67, 2); this.time += Math.min(elapsed, 50);
    if (elapsed > 28) this.slowFrames++;
    if (++this.frameCount >= 180) {
      if (this.slowFrames > 50) this.performanceScale = Math.max(.25, this.performanceScale * .7);
      // Retain every letter point; reduce and retire only surplus ambient particles.
      let free = 0, retained = 0;
      const budget = this.desiredCount();
      for (const particle of this.particles) {
        if (particle.state !== 'FLOATING' || free++ < budget) this.particles[retained++] = particle;
      }
      this.particles.length = retained;
      this.canvas.dataset.particleCount = String(this.particles.length);
      this.frameCount = 0; this.slowFrames = 0;
    }
    for (const waiter of this.waiters) if (this.time >= waiter.end) { this.waiters.delete(waiter); waiter.finish(); }
    const ctx = this.ctx; ctx.globalAlpha = 1; ctx.fillStyle = '#06080b'; ctx.fillRect(0, 0, this.width, this.height); ctx.fillStyle = '#eef7fc';
    let forming = 0, dispersing = 0, floating = 0;
    const ambient = this.desiredCount();
    for (const p of this.particles) {
      if (p.state === 'HOLDING') continue;
      if (p.state === 'FORMING') {
        const age = this.time - p.activation;
        if (age < 0) { p.opacity = 0; continue; }
        forming++;
        const progress = Math.min(1, age / Math.max(1, p.duration));
        const t = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
        p.x = (1 - t) ** 2 * p.fromX + 2 * (1 - t) * t * p.controlX + t * t * p.targetX;
        p.y = (1 - t) ** 2 * p.fromY + 2 * (1 - t) * t * p.controlY + t * t * p.targetY;
        p.opacity += (p.targetOpacity - p.opacity) * Math.min(1, .12 * dt);
        if (progress === 1) { p.x = p.targetX; p.y = p.targetY; p.state = 'HOLDING'; }
      } else {
        if (p.state === 'FLOATING' && floating++ >= ambient) { p.opacity = 0; continue; }
        if (!this.reducedMotion) {
          if (p.state === 'FLOATING') {
            const driftX = p.homeX + Math.sin(this.time * .00015 + p.phase) * 25;
            const driftY = p.homeY + Math.cos(this.time * .00012 + p.phase) * 20;
            p.velocityX += (driftX - p.x) * .0015 * dt; p.velocityY += (driftY - p.y) * .0015 * dt;
            const dx = p.x - this.pointer.x, dy = p.y - this.pointer.y, dist = Math.hypot(dx, dy);
            if (dist < 95 && dist > 1) { const force = (1 - dist / 95) * .28; p.velocityX += dx / dist * force; p.velocityY += dy / dist * force; }
          }
          p.velocityX *= Math.pow(.96, dt); p.velocityY *= Math.pow(.96, dt);
          p.x += p.velocityX * dt; p.y += p.velocityY * dt;
        }
        if (p.state === 'DISPERSING') { dispersing++; p.opacity *= Math.pow(.96, dt); if (this.time >= p.release) { p.state = 'FLOATING'; p.homeX = p.x; p.homeY = p.y; } }
        else {
          // Keep the central reading area free from distracting ambient points.
          const inText = this.presentation && p.x > this.width * .06 && p.x < this.width * .94 && p.y > this.height * .15 && p.y < this.height * .85;
          p.opacity += ((inText ? .012 : .10) - p.opacity) * .06 * dt;
        }
      }
      if (p.opacity < .008) continue;
      ctx.globalAlpha = p.opacity; ctx.beginPath(); ctx.arc(p.x, p.y, p.state === 'FORMING' ? p.targetSize : p.size, 0, Math.PI * 2); ctx.fill();
    }
    // Settled letters never jitter and share one draw call.
    ctx.globalAlpha = 1; ctx.beginPath();
    for (const p of this.assignments.values()) if (p.state === 'HOLDING') { ctx.moveTo?.(p.x + p.targetSize, p.y); ctx.arc(p.x, p.y, p.targetSize, 0, Math.PI * 2); }
    ctx.fill();
    if (this.presentation) {
      const { layout, timeline, start, typing, cursorUntil } = this.presentation;
      const count = typing ? timeline.filter(t => t <= this.time - start).length : layout.count;
      if (this.canvas.dataset.visibleCharacters !== String(count)) this.canvas.dataset.visibleCharacters = String(count);
      this.drawEmoji(layout, timeline, start);
      if (typing && this.time < cursorUntil) {
        const cursor = layout.cursors[count];
        if (cursor && Math.floor((this.time - start) / 480) % 2 === 0) { ctx.globalAlpha = .9; ctx.fillRect(cursor.x + 2, cursor.y - layout.fontSize * .42, Math.max(1.5, layout.fontSize / 35), layout.fontSize * .85); }
      }
    }
    for (const layout of this.uiLayouts) this.drawEmoji(layout);
    ctx.globalAlpha = 1;
    const phase = forming ? 'forming' : this.assignments.size ? 'holding' : dispersing ? 'dispersing' : 'floating';
    if (this.canvas.dataset.phase !== phase) this.canvas.dataset.phase = phase;
  };
  destroy() {
    this.disposed = true; cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.resize); window.removeEventListener('scroll', this.refresh);
    window.removeEventListener('pointermove', this.move); window.removeEventListener('pointerout', this.leave);
    document.removeEventListener('visibilitychange', this.visibility); this.motion.removeEventListener('change', this.changeMotion);
    this.waiters.forEach(waiter => waiter.abort()); this.waiters.clear();
  }
}
