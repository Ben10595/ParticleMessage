import { createTextLayout, type TextLayout } from './textSampler';
import type { Target } from './targetGenerators';
import { EFFECTS, type TransitionEffect, type WritingSettings } from '../types/message';
import { typingTimeline } from '../lib/playback';
import { sampleUI } from './uiSampler';
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
  private uiRoot: HTMLElement | null = null;
  private uiTargets: Target[] = [];
  private textTargets: Target[] = [];
  private exclusions: DOMRect[] = [];
  private textBounds: { x: number; y: number; right: number; bottom: number } | null = null;
  private refreshFrame = 0;
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
  private desiredCount() { return Math.round(Math.min(this.width < 700 ? 650 : 1500, Math.max(450, this.width * this.height / 750)) * this.performanceScale); }
  private resize = () => {
    this.width = window.innerWidth; this.height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * dpr); this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    while (this.particles.length < this.desiredCount()) this.particles.push(this.makeParticle());
    this.refresh();
  };
  refresh = () => {
    if (this.disposed || this.refreshFrame) return;
    this.refreshFrame = requestAnimationFrame(() => {
      this.refreshFrame = 0;
      if (this.uiRoot?.isConnected) this.captureUI();
      if (this.scene) this.scene();
      else this.setParticleTargets(this.uiTargets, false);
    });
  };
  private captureUI() {
    if (!this.uiRoot) return;
    const sample = sampleUI(this.uiRoot, this.height);
    this.uiTargets = sample.targets; this.uiLayouts = sample.layouts; this.exclusions = sample.exclusions;
  }
  private mergeTargets(animate = true, effect: TransitionEffect = 'morph', duration = 1150) {
    this.canvas.dataset.uiTargetCount = String(this.uiTargets.length);
    this.canvas.dataset.textTargetCount = String(this.textTargets.length);
    this.setParticleTargets([...this.uiTargets, ...this.textTargets], animate, effect, duration);
  }
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
      const unchanged = p.targetX === target.x && p.targetY === target.y && (p.state === 'HOLDING' || p.state === 'FORMING');
      p.targetX = target.x; p.targetY = target.y; p.targetOpacity = target.opacity ?? 1; p.targetSize = target.size ?? 1;
      if (unchanged) return;
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
    p.state = 'DISPERSING'; p.release = this.time + 1400;
    p.homeX = Math.random() * this.width; p.homeY = Math.random() * this.height;
    p.velocityX = Math.cos(p.phase) * (1.5 + p.speed) * strength;
    p.velocityY = Math.sin(p.phase) * (1.5 + p.speed) * strength;
    if (this.reducedMotion) { p.state = 'FLOATING'; p.opacity = 0; }
  }
  disperseParticles(strength = 1) {
    this.scene = null; this.presentation = null; this.textBounds = null; this.uiLayouts = []; this.uiTargets = []; this.textTargets = []; this.uiRoot = null; this.assignments.clear();
    this.canvas.dataset.phase = 'dispersing';
    this.particles.forEach(p => { if (p.state !== 'FLOATING') this.releaseParticle(p, strength); });
  }
  disperseText(strength = .8) {
    this.scene = null; this.presentation = null; this.textBounds = null; this.textTargets = [];
    for (const [key, p] of this.assignments) if (!key.startsWith('ui-')) { this.releaseParticle(p, strength); this.assignments.delete(key); }
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
      this.textBounds = layout.glyphs.length ? { x: Math.min(...layout.glyphs.map(g => g.x)) - 12, right: Math.max(...layout.glyphs.map(g => g.x + g.width)) + 12, y: Math.min(...layout.glyphs.map(g => g.y)) - layout.fontSize, bottom: Math.max(...layout.glyphs.map(g => g.y)) + layout.fontSize } : null;
      this.presentation = { layout, timeline, start, typing: timeline.length > 0, cursorUntil: start + completion + 1100 };
      const elapsed = this.time - start;
      this.textTargets = layout.targets.map(p => ({ ...p, delay: Math.max(0, (timeline[p.glyph ?? 0] ?? 0) - elapsed) }));
      this.mergeTargets(!refresh, opts.effect, duration);
      // Resize preserves the writing timeline and never reveals future letters early.
      if (refresh && timeline.length && !this.reducedMotion) for (const [key, p] of this.assignments) {
        if (key.startsWith('ui-')) continue;
        const glyph = Number(key.split('-')[1]);
        if ((timeline[glyph] ?? 0) > elapsed) { p.state = 'FORMING'; p.activation = start + timeline[glyph]; p.opacity = 0; }
      }
    };
    this.scene = () => form(true); form();
    return completion;
  }
  formUI(root: HTMLElement, animate = true) {
    this.uiRoot = root; this.captureUI(); this.mergeTargets(animate);
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
            const driftX = p.homeX + Math.sin(this.time * .00012 * p.speed + p.phase) * 115;
            const driftY = p.homeY + Math.cos(this.time * .00010 * p.speed + p.phase) * 90;
            p.velocityX += (driftX - p.x) * .0015 * dt; p.velocityY += (driftY - p.y) * .0015 * dt;
            const dx = p.x - this.pointer.x, dy = p.y - this.pointer.y, dist = Math.hypot(dx, dy);
            if (dist < 95 && dist > 1) { const force = (1 - dist / 95) * .28; p.velocityX += dx / dist * force; p.velocityY += dy / dist * force; }
          }
          p.velocityX *= Math.pow(.96, dt); p.velocityY *= Math.pow(.96, dt);
          p.x += p.velocityX * dt; p.y += p.velocityY * dt;
        }
        if (p.state === 'DISPERSING') { dispersing++; p.opacity *= Math.pow(.96, dt); if (this.time >= p.release) { p.state = 'FLOATING'; } }
        else {
          // Keep the central reading area free from distracting ambient points.
          const inText = this.textBounds && p.x > this.textBounds.x && p.x < this.textBounds.right && p.y > this.textBounds.y && p.y < this.textBounds.bottom;
          const behindUI = this.exclusions.some(rect => p.x > rect.x - 8 && p.x < rect.right + 8 && p.y > rect.y - 7 && p.y < rect.bottom + 7);
          p.opacity += ((inText || behindUI ? .012 : .13 + p.speed * .18) - p.opacity) * .06 * dt;
        }
      }
      if (p.opacity < .008) continue;
      ctx.globalAlpha = p.opacity; ctx.beginPath(); ctx.arc(p.x, p.y, p.state === 'FORMING' ? p.targetSize : p.size, 0, Math.PI * 2); ctx.fill();
    }
    // A handful of draw calls keeps dense glyphs bright and frames translucent.
    for (const alpha of [.25, .5, .75, 1]) {
      ctx.globalAlpha = alpha; ctx.beginPath();
      for (const p of this.assignments.values()) if (p.state === 'HOLDING' && Math.ceil(p.targetOpacity * 4) / 4 === alpha) {
        ctx.moveTo?.(p.x + p.targetSize, p.y); ctx.arc(p.x, p.y, p.targetSize, 0, Math.PI * 2);
      }
      ctx.fill();
    }
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
    const phase = forming ? 'forming' : dispersing ? 'dispersing' : this.assignments.size ? 'holding' : 'floating';
    if (this.canvas.dataset.phase !== phase) this.canvas.dataset.phase = phase;
  };
  destroy() {
    this.disposed = true; cancelAnimationFrame(this.frame); cancelAnimationFrame(this.refreshFrame);
    window.removeEventListener('resize', this.resize); window.removeEventListener('scroll', this.refresh);
    window.removeEventListener('pointermove', this.move); window.removeEventListener('pointerout', this.leave);
    document.removeEventListener('visibilitychange', this.visibility); this.motion.removeEventListener('change', this.changeMotion);
    this.waiters.forEach(waiter => waiter.abort()); this.waiters.clear();
  }
}
