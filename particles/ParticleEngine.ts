import { createTextLayout, type TextLayout } from './textSampler';
import { createLineTargets, type Target } from './targetGenerators';
import { EFFECTS, type TransitionEffect, type WritingSettings } from '../types/message';
import { graphemes, typingTimeline } from '../lib/playback';
import { sampleUI } from './uiSampler';
export type ParticleState = 'FLOATING' | 'FORMING' | 'HOLDING' | 'MORPHING' | 'DISPERSING';
export interface Particle {
  x: number; y: number; targetX: number; targetY: number; velocityX: number; velocityY: number;
  depth: number; animationDelay: number; animationSeed: number;
  size: number; opacity: number; idleOffset: number; phase: number; speed: number; spring: number;
  state: ParticleState; activation: number; release: number; targetOpacity: number; targetSize: number;
  fromX: number; fromY: number; controlX: number; controlY: number; duration: number; homeX: number; homeY: number;
}
interface Presentation { layout: TextLayout; timeline: number[]; start: number; typing: boolean; cursorUntil: number; cursorCount: number; formation: number }
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
  private lastText = '';
  private fpsTotal = 0; private fpsFrames = 0;
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
      depth: .3 + Math.random() * .7, animationDelay: 0, animationSeed: Math.random(),
      size: .55 + Math.random() * .55, opacity: .08, idleOffset: Math.random() * Math.PI * 2,
      phase: Math.random() * 10, speed: .4 + Math.random() * .6, spring: .03,
      state: 'FLOATING', activation: 0, release: 0, targetOpacity: 1, targetSize: 1,
      fromX: x, fromY: y, controlX: x, controlY: y, duration: 1000 };
  }
  private desiredCount() { return Math.round((this.width < 700 ? 1400 : 3000) * this.performanceScale); }
  private ambientCount() { return Math.max(Math.round((this.width < 700 ? 500 : 900) * this.performanceScale), this.desiredCount() - this.assignments.size); }
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
  private captureUI(departing = false) {
    if (!this.uiRoot) return;
    const sample = sampleUI(this.uiRoot, this.height, departing);
    this.uiTargets = sample.targets; this.uiLayouts = sample.layouts; this.exclusions = sample.exclusions;
  }
  private mergeTargets(animate = true, effect: TransitionEffect = 'morph', duration = 1150) {
    this.canvas.dataset.uiTargetCount = String(this.uiTargets.length);
    this.canvas.dataset.textTargetCount = String(this.textTargets.length);
    this.setParticleTargets([...this.uiTargets, ...this.textTargets], animate, effect, duration);
  }
  setParticleTargets(targets: Target[], animate = true, effect: TransitionEffect = 'morph', duration = 1150) {
    if (effect === 'random') effect = EFFECTS[Math.floor(Math.random() * (EFFECTS.length - 1))];
    while (this.particles.length < Math.max(targets.length + (this.width < 700 ? 500 : 900), this.desiredCount())) this.particles.push(this.makeParticle());
    const available = new Set(this.particles);
    const next = new Map<string, Particle>();
    for (let i = 0; i < targets.length; i++) {
      const key = targets[i].key ?? `point-${i}`, existing = this.assignments.get(key);
      if (existing && (!key.startsWith('glyph-') || Math.hypot(existing.targetX - targets[i].x, existing.targetY - targets[i].y) < 96) && available.delete(existing)) next.set(key, existing);
    }
    // Separate occupied and free spatial buckets. Remove each selected point from
    // its bucket immediately, so dense mobile glyphs never rescan claimed points.
    const occupied = new Map<string, Particle[]>(), floating = new Map<string, Particle[]>();
    available.forEach(p => {
      const key = `${Math.floor(p.x / 64)},${Math.floor(p.y / 64)}`;
      const grid = p.state === 'FLOATING' ? floating : occupied;
      const bucket = grid.get(key) ?? []; bucket.push(p); grid.set(key, bucket);
    });
    const take = (grid: Map<string, Particle[]>, target?: Target): Particle | undefined => {
      if (!grid.size) return;
      const gx = target ? Math.floor(target.x / 64) : 0, gy = target ? Math.floor(target.y / 64) : 0;
      const remove = (key: string, bucket: Particle[], index: number) => {
        const point = bucket[index]; bucket[index] = bucket[bucket.length - 1]; bucket.pop();
        if (!bucket.length) grid.delete(key);
        return point;
      };
      if (!target) { const [key, bucket] = grid.entries().next().value!; return remove(key, bucket, bucket.length - 1); }
      for (let ring = 0; ring <= 3; ring++) {
        let best: { key: string; bucket: Particle[]; index: number } | undefined, distance = Infinity;
        for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
          if (ring && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const key = `${gx + dx},${gy + dy}`, bucket = grid.get(key);
          if (!bucket) continue;
          for (let index = 0; index < bucket.length; index++) {
            const candidate = bucket[index];
            const d = (candidate.x - target.x) ** 2 + (candidate.y - target.y) ** 2;
            if (d < distance) { best = { key, bucket, index }; distance = d; }
          }
        }
        if (best) return remove(best.key, best.bucket, best.index);
      }
    };
    targets.forEach((target, index) => {
      const key = target.key ?? `point-${index}`;
      let p = next.get(key);
      if (!p) {
        p = take(occupied, target) ?? take(floating, target) ?? take(occupied) ?? take(floating)!;
        available.delete(p); next.set(key, p);
      }
      const unchanged = p.targetX === target.x && p.targetY === target.y && (p.state === 'HOLDING' || p.state === 'FORMING' || p.state === 'MORPHING');
      p.targetX = target.x; p.targetY = target.y; p.targetOpacity = target.opacity ?? 1; p.targetSize = target.size ?? 1;
      if (unchanged) return;
      p.fromX = p.x; p.fromY = p.y;
      const dx = target.x - p.x, dy = target.y - p.y;
      const bend = Math.sin(p.phase) * Math.min(25, Math.hypot(dx, dy) * .09);
      p.controlX = (p.x + target.x) / 2 + bend; p.controlY = (p.y + target.y) / 2 - bend;
      const cx = this.width / 2, cy = this.height / 2;
      if (effect === 'scatter' || effect === 'explosion' || effect === 'outward') { p.controlX += Math.cos(p.phase) * 60; p.controlY += Math.sin(p.phase) * 60; }
      if (effect === 'vortex') { p.controlX = (p.x + target.x) / 2 - (target.y - p.y) * .35; p.controlY = (p.y + target.y) / 2 + (target.x - p.x) * .35; }
      if (effect === 'wave') p.controlY += Math.sin(target.x / this.width * Math.PI * 2) * 45;
      if (effect === 'rain') p.controlY = Math.max(p.y, target.y) + 130;
      if (effect === 'implode') { p.controlX = cx; p.controlY = cy; }
      p.animationDelay = (target.delay ?? 0) + (effect === 'wave' ? target.x / this.width * 320 : p.animationSeed * 80);
      p.activation = this.time + (this.reducedMotion ? 0 : p.animationDelay);
      p.duration = duration; p.state = p.state === 'FLOATING' ? 'FORMING' : 'MORPHING'; p.velocityX = 0; p.velocityY = 0;
      if (this.reducedMotion || !animate) { p.state = 'HOLDING'; p.x = target.x; p.y = target.y; p.opacity = p.targetOpacity; p.size = p.targetSize; }
    });
    available.forEach(p => { if (p.state === 'FORMING' || p.state === 'MORPHING' || p.state === 'HOLDING') this.releaseParticle(p); });
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
    this.scene = null; this.presentation = null; this.textBounds = null; this.uiLayouts = []; this.uiTargets = []; this.textTargets = []; this.uiRoot = null; this.exclusions = []; this.assignments.clear();
    this.canvas.dataset.phase = 'dispersing';
    this.particles.forEach(p => { if (p.state !== 'FLOATING') this.releaseParticle(p, strength); });
  }
  disperseText(strength = .8) {
    this.scene = null; this.presentation = null; this.textBounds = null; this.textTargets = [];
    this.canvas.dataset.textTargetCount = '0'; this.canvas.dataset.targetCount = String(this.uiTargets.length);
    for (const [key, p] of this.assignments) if (!key.startsWith('ui-')) { this.releaseParticle(p, strength); this.assignments.delete(key); }
  }
  // Preserve assignments through the signature edit effect; the next text reclaims them.
  loosenText() {
    this.scene = null; this.presentation = null; this.textTargets = [];
    for (const [key, p] of this.assignments) if (!key.startsWith('ui-')) this.releaseParticle(p, .3);
  }
  morphParticles(targets: Target[], effect: TransitionEffect = 'morph') { this.setParticleTargets(targets, true, effect); }
  formText(text: string, options: FormOptions | boolean = {}): number {
    const opts = typeof options === 'boolean' ? {} : options;
    const start = this.time;
    if (text !== this.lastText) {
      const previous = graphemes(this.lastText), incoming = graphemes(text);
      for (const key of this.assignments.keys()) if (key.startsWith('glyph-')) {
        const index = Number(key.split('-')[1]);
        if (previous[index] !== incoming[index]) this.assignments.delete(key);
      }
      this.lastText = text;
    }
    const timeline = opts.writing?.enabled && !this.reducedMotion ? typingTimeline(text, opts.writing) : [];
    const duration = this.reducedMotion ? 0 : timeline.length ? (opts.finale ? 850 : 430) : opts.finale ? 2000 : 1150;
    const completion = (timeline.at(-1) ?? 0) + duration + (timeline.length ? 900 : 360);
    const form = (refresh = false) => {
      const rect = opts.bounds?.();
      const width = rect?.width ?? this.width * .84, height = rect?.height ?? this.height * .64;
      const layout = createTextLayout(text, { x: rect?.x ?? this.width * .08, y: rect?.y ?? this.height * .18, width, height, fontSize: Math.min(rect ? 64 : 120, width / (rect ? 7 : 8)), fit: true, weight: 600 });
      this.canvas.dataset.textFontSize = String(layout.fontSize);
      this.canvas.dataset.textLineCount = String(new Set(layout.glyphs.map(g => g.y)).size);
      this.textBounds = layout.glyphs.length ? { x: Math.min(...layout.glyphs.map(g => g.x)) - 12, right: Math.max(...layout.glyphs.map(g => g.x + g.width)) + 12, y: Math.min(...layout.glyphs.map(g => g.y)) - layout.fontSize, bottom: Math.max(...layout.glyphs.map(g => g.y)) + layout.fontSize } : null;
      this.presentation = { layout, timeline, start, typing: timeline.length > 0, cursorUntil: start + completion, cursorCount: -1, formation: duration };
      const elapsed = this.time - start;
      this.textTargets = layout.targets.map(p => ({ ...p, delay: Math.max(0, (timeline[p.glyph ?? 0] ?? 0) - elapsed) }));
      if (timeline.length) {
        const cursor = layout.cursors[0];
        if (cursor) this.textTargets.push(...createLineTargets(cursor.x + 3, cursor.y - layout.fontSize * .4, cursor.x + 3, cursor.y + layout.fontSize * .4, 2.4).map((p, i) => ({ ...p, key: `cursor-${i}`, size: .8, opacity: .8 })));
      }
      this.mergeTargets(!refresh, opts.effect, duration);
      // Resize preserves the writing timeline and never reveals future letters early.
      if (refresh && timeline.length && !this.reducedMotion) for (const [key, p] of this.assignments) {
        if (key.startsWith('ui-') || key.startsWith('cursor-')) continue;
        const glyph = Number(key.split('-')[1]);
        if ((timeline[glyph] ?? 0) > elapsed) { p.state = 'FORMING'; p.x = p.fromX; p.y = p.fromY; p.activation = start + timeline[glyph]; p.opacity = 0; }
      }
    };
    this.scene = () => form(true); form();
    return completion;
  }
  formUI(root: HTMLElement, animate = true) {
    this.uiRoot = root; this.captureUI(); this.mergeTargets(animate);
  }
  // Capture editable DOM ink into this same pool just before dissolving the scene.
  departUI(root: HTMLElement) {
    this.uiRoot = root; this.captureUI(true); this.mergeTargets(false);
    this.disperseParticles(.4);
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
    this.fpsTotal += elapsed; this.fpsFrames++;
    if (this.fpsFrames >= 60) { this.canvas.dataset.fps = String(Math.round(1000 * this.fpsFrames / this.fpsTotal)); this.fpsTotal = 0; this.fpsFrames = 0; }
    if (elapsed > 28) this.slowFrames++;
    if (++this.frameCount >= 180) {
      if (this.slowFrames > 50) this.performanceScale = Math.max(.25, this.performanceScale * .7);
      // Retain every letter point; reduce and retire only surplus ambient particles.
      let free = 0, retained = 0;
      const budget = this.ambientCount();
      for (const particle of this.particles) {
        if (particle.state !== 'FLOATING' || free++ < budget) this.particles[retained++] = particle;
      }
      this.particles.length = retained;
      this.canvas.dataset.particleCount = String(this.particles.length);
      this.frameCount = 0; this.slowFrames = 0;
    }
    for (const waiter of this.waiters) if (this.time >= waiter.end) { this.waiters.delete(waiter); waiter.finish(); }
    const ctx = this.ctx; ctx.globalAlpha = 1; ctx.fillStyle = '#050608'; ctx.fillRect(0, 0, this.width, this.height); ctx.fillStyle = '#eef7fc';
    let forming = 0, dispersing = 0, floating = 0;
    const ambient = this.ambientCount();
    for (const p of this.particles) {
      if (p.state === 'HOLDING') {
        const ease = this.reducedMotion ? 1 : Math.min(1, dt * .16);
        p.opacity += (p.targetOpacity - p.opacity) * ease;
        p.size += (p.targetSize - p.size) * ease;
        continue;
      }
      if (p.state === 'FORMING' || p.state === 'MORPHING') {
        const age = this.time - p.activation;
        if (age < 0) { p.opacity += (.1 - p.opacity) * .05; ctx.globalAlpha = p.opacity; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); continue; }
        forming++;
        const progress = Math.min(1, age / Math.max(1, p.duration));
        const t = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
        const anchorX = (1 - t) ** 2 * p.fromX + 2 * (1 - t) * t * p.controlX + t * t * p.targetX;
        const anchorY = (1 - t) ** 2 * p.fromY + 2 * (1 - t) * t * p.controlY + t * t * p.targetY;
        p.velocityX = (p.velocityX + (anchorX - p.x) * .16 * dt) * Math.pow(.54, dt);
        p.velocityY = (p.velocityY + (anchorY - p.y) * .16 * dt) * Math.pow(.54, dt);
        p.x += p.velocityX * dt; p.y += p.velocityY * dt;
        p.opacity += (p.targetOpacity - p.opacity) * Math.min(1, .12 * dt);
        if (progress === 1 && Math.hypot(p.x - p.targetX, p.y - p.targetY) < .3) { p.x = p.targetX; p.y = p.targetY; p.state = 'HOLDING'; p.size = p.targetSize; }
      } else {
        if (p.state === 'FLOATING' && floating++ >= ambient) { p.opacity = 0; continue; }
        if (!this.reducedMotion) {
          if (p.state === 'FLOATING') {
            const driftX = p.homeX + Math.sin(this.time * .00012 * p.speed + p.phase) * 115 * p.depth;
            const driftY = p.homeY + Math.cos(this.time * .00010 * p.speed + p.phase) * 90 * p.depth;
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
      ctx.globalAlpha = p.opacity; ctx.beginPath(); ctx.arc(p.x, p.y, p.state === 'FORMING' || p.state === 'MORPHING' ? p.targetSize : p.size, 0, Math.PI * 2); ctx.fill();
    }
    if (this.presentation?.typing) {
      const presentation = this.presentation;
      const { layout, timeline, start, cursorUntil } = presentation;
      const count = timeline.filter(t => t + presentation.formation * .75 <= this.time - start).length;
      const cursor = layout.cursors[count];
      if (cursor) {
        let i = 0;
        for (const [key, p] of this.assignments) if (key.startsWith('cursor-')) {
          const x = cursor.x + 3, y = cursor.y - layout.fontSize * .4 + i++ * 2.4;
          if (count !== presentation.cursorCount) {
            p.fromX = p.x; p.fromY = p.y; p.controlX = (p.x + x) / 2; p.controlY = (p.y + y) / 2;
            p.targetX = x; p.targetY = y; p.state = 'MORPHING'; p.activation = this.time; p.duration = 80;
          }
          p.targetOpacity = this.time < cursorUntil && Math.floor((this.time - start) / 480) % 2 === 0 ? .8 : 0;
        }
        presentation.cursorCount = count;
      }
    }
    // A handful of draw calls keeps dense glyphs bright and frames translucent.
    for (const alpha of [.125, .25, .375, .5, .625, .75, .875, 1]) {
      ctx.globalAlpha = alpha; ctx.beginPath();
      for (const p of this.assignments.values()) if (p.state === 'HOLDING' && Math.round(p.opacity * 8) / 8 === alpha) {
        ctx.moveTo?.(p.x + p.size, p.y); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    if (this.presentation) {
      const { layout, timeline, start, typing } = this.presentation;
      const count = typing ? timeline.filter(t => t <= this.time - start).length : layout.count;
      if (this.canvas.dataset.visibleCharacters !== String(count)) this.canvas.dataset.visibleCharacters = String(count);
      this.drawEmoji(layout, timeline, start);
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
