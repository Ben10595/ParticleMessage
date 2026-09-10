import { createTextLayout, type TextLayout } from './textSampler';
import { createLineTargets, type Target } from './targetGenerators';
import { EFFECTS, type TransitionEffect, type WritingSettings } from '../types/message';
import { graphemes, typingTimeline } from '../lib/playback';
import { sampleUI } from './uiSampler';
import { perlin2, smoothstep } from './noise';
export type ParticleState = 'FLOATING' | 'FORMING' | 'HOLDING' | 'MORPHING' | 'DISPERSING';
export interface Particle {
  x: number; y: number; targetX: number; targetY: number; velocityX: number; velocityY: number;
  softness: number; ambientSize: number; ambientOpacity: number; releaseStrength: number; glow: boolean; damping: number;
  depth: number; animationDelay: number; animationSeed: number;
  size: number; opacity: number; idleOffset: number; phase: number; speed: number; spring: number;
  state: ParticleState; activation: number; release: number; targetOpacity: number; targetSize: number;
  fromX: number; fromY: number; controlX: number; controlY: number; duration: number; homeX: number; homeY: number;
  theme?: 'cool' | 'warm';
  isUI?: boolean;
  loop?: Target['loop'];
  baseTargetX?: number;
  baseTargetY?: number;
  sparkle?: number;
  impactGlow?: number;
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  alpha: number;
}
interface TrailParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  opacity: number;
}
interface FlowParticle {
  startX: number;
  startY: number;
  controlX: number;
  controlY: number;
  endX: number;
  endY: number;
  x: number;
  y: number;
  startTime: number;
  duration: number;
  size: number;
  alpha: number;
  seed: number;
}
interface Presentation { layout: TextLayout; timeline: number[]; start: number; typing: boolean; cursorUntil: number; cursorCount: number; formation: number }
export interface FormOptions { bounds?: () => DOMRect; writing?: WritingSettings; effect?: TransitionEffect; finale?: boolean }
export class ParticleEngine {
  readonly particles: Particle[] = [];
  width = 0; height = 0; time = 0; reducedMotion = false;
  private ctx: CanvasRenderingContext2D;
  private dustSprite: HTMLCanvasElement;
  private dustSpriteCool: HTMLCanvasElement;
  private sparks: Spark[] = [];
  private trail: TrailParticle[] = [];
  private flowParticles: FlowParticle[] = [];
  private dpr = 1;
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
    this.ctx = ctx;
    this.dustSprite = this.createDustSprite(false);
    this.dustSpriteCool = this.createDustSprite(true);
    this.reducedMotion = this.motion.matches;
    this.resize();
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
  private move = (event: PointerEvent) => {
    const prevX = this.pointer.x, prevY = this.pointer.y;
    this.pointer.x = event.clientX; this.pointer.y = event.clientY;
    const dist = Math.hypot(event.clientX - prevX, event.clientY - prevY);
    if (dist > 7 && prevX >= 0 && !this.reducedMotion && this.trail.length < 36) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.2 + Math.random() * 0.5;
      this.trail.push({
        x: event.clientX + (Math.random() - 0.5) * 6,
        y: event.clientY + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 0.9 + Math.random() * 1.3,
        life: 600,
        maxLife: 600,
        opacity: 0.28,
      });
    }
  };
  private leave = () => { this.pointer.x = -1000; this.pointer.y = -1000; };
  private createDustSprite(cool = false) {
    const sprite = document.createElement('canvas'); sprite.width = sprite.height = 32;
    const ctx = sprite.getContext('2d')!;
    const halo = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    if (cool) {
      halo.addColorStop(0, '#edf4fc'); halo.addColorStop(.22, '#d8e5f2');
      halo.addColorStop(.46, '#a4c2e038'); halo.addColorStop(1, '#88a8cc00');
    } else {
      halo.addColorStop(0, '#fff3d9'); halo.addColorStop(.22, '#ffeac8');
      halo.addColorStop(.46, '#f2cf9348'); halo.addColorStop(1, '#d9a65c00');
    }
    ctx.fillStyle = halo; ctx.fillRect(0, 0, 32, 32);
    return sprite;
  }
  private makeParticle(): Particle {
    const x = Math.random() * this.width, y = Math.random() * this.height;
    const depth = .3 + Math.random() * .7;
    const ambientSize = .5 + depth * .85;
    return { softness: 1, ambientSize, ambientOpacity: .3 + depth * .3, releaseStrength: 0, glow: false, damping: .54, x, y, homeX: x, homeY: y, targetX: 0, targetY: 0, velocityX: 0, velocityY: 0,
      depth, animationDelay: 0, animationSeed: Math.random(),
      size: ambientSize, opacity: .08, idleOffset: Math.random() * Math.PI * 2,
      phase: Math.random() * 10, speed: .4 + Math.random() * .6, spring: .16,
      state: 'FLOATING', activation: 0, release: 0, targetOpacity: 1, targetSize: 1,
      fromX: x, fromY: y, controlX: x, controlY: y, duration: 1000, theme: 'cool' };
  }
  private desiredCount() { return Math.round((this.width < 700 ? 1400 : 3000) * this.performanceScale); }
  private ambientCount() { return Math.max(Math.round((this.width < 700 ? 500 : 900) * this.performanceScale), this.desiredCount() - this.assignments.size); }
  private resize = () => {
    this.width = window.innerWidth; this.height = window.innerHeight;
    const dpr = this.dpr = Math.min(window.devicePixelRatio || 1, 2);
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
      p.theme = target.theme ?? (key.startsWith('ui-') ? 'cool' : 'warm');
      p.isUI = Boolean(target.isUI || key.startsWith('ui-'));
      p.loop = target.loop;
      p.baseTargetX = target.x;
      p.baseTargetY = target.y;
      const unchanged = p.targetX === target.x && p.targetY === target.y && (p.state === 'HOLDING' || p.state === 'FORMING' || p.state === 'MORPHING');
      p.targetX = target.x; p.targetY = target.y; p.targetOpacity = target.opacity ?? 1; p.glow = target.glow ?? false; p.targetSize = target.size ?? 1;
      if (unchanged) return;
      p.fromX = p.x; p.fromY = p.y;
      const dx = target.x - p.x, dy = target.y - p.y;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const bend = Math.sin(p.phase) * Math.min(65, Math.max(18, dist * 0.25));
      p.controlX = (p.x + target.x) / 2 - Math.sin(angle) * bend;
      p.controlY = (p.y + target.y) / 2 + Math.cos(angle) * bend;
      const cx = this.width / 2, cy = this.height / 2;
      if (effect === 'scatter' || effect === 'explosion' || effect === 'outward') { p.controlX += Math.cos(p.phase) * 60; p.controlY += Math.sin(p.phase) * 60; }
      if (effect === 'vortex') { p.controlX = (p.x + target.x) / 2 - (target.y - p.y) * .35; p.controlY = (p.y + target.y) / 2 + (target.x - p.x) * .35; }
      if (effect === 'wave') p.controlY += Math.sin(target.x / this.width * Math.PI * 2) * 45;
      if (effect === 'rain') p.controlY = Math.max(p.y, target.y) + 130;
      if (effect === 'implode') { p.controlX = cx; p.controlY = cy; }
      p.animationDelay = (target.delay ?? 0) + (effect === 'wave' ? target.x / this.width * 320 : p.animationSeed * 60);
      p.activation = this.time + (this.reducedMotion ? 0 : p.animationDelay);
      p.duration = duration; p.state = p.state === 'FLOATING' ? 'FORMING' : 'MORPHING';
      if (this.reducedMotion || !animate) { p.velocityX = p.velocityY = 0; p.state = 'HOLDING'; p.x = target.x; p.y = target.y; p.opacity = p.targetOpacity; p.size = p.targetSize; p.softness = 0; }
    });
    available.forEach(p => { if (p.state === 'FORMING' || p.state === 'MORPHING' || p.state === 'HOLDING') this.releaseParticle(p); });
    this.assignments = next;
    this.canvas.dataset.particleCount = String(this.particles.length);
    this.canvas.dataset.targetCount = String(targets.length);
    this.canvas.dataset.phase = this.reducedMotion ? 'holding' : 'forming';
  }
  private releaseParticle(p: Particle, strength = 1) {
    p.state = 'DISPERSING'; p.release = this.time + 1400; p.releaseStrength = strength;
    // Preserve position AND momentum: release gradually joins the same noise field.
    if (this.reducedMotion) { p.state = 'FLOATING'; p.opacity = 0; p.velocityX = p.velocityY = 0; }
  }
  private drift(p: Particle, dt: number, release = 0) {
    if (this.reducedMotion) return;
    const time = this.time * .000018;
    const nx = p.x * .0025 + p.phase, ny = p.y * .0025;
    const speed = .12 + p.depth * .2;
    let vx = perlin2(nx + time, ny + 17.3) * speed * 2;
    let vy = perlin2(nx + 91.7, ny - time) * speed * 2;
    vx += Math.cos(p.phase * 7) * release * p.releaseStrength * .65;
    vy += Math.sin(p.phase * 7) * release * p.releaseStrength * .65;
    // Gentle boundary steering instead of wrapping or respawning on screen.
    vx += (Math.max(0, 60 - p.x) - Math.max(0, p.x - this.width + 60)) * .004;
    vy += (Math.max(0, 60 - p.y) - Math.max(0, p.y - this.height + 60)) * .004;
    const dx = p.x - this.pointer.x, dy = p.y - this.pointer.y, distance = Math.hypot(dx, dy);
    const radius = 130;
    if (distance > 1 && distance < radius) {
      const force = ((1 - distance / radius) ** 1.6) * .42;
      vx += (dx / distance) * force * 1.8;
      vy += (dy / distance) * force * 1.8;
      vx += (-dy / distance) * force * .35;
      vy += (dx / distance) * force * .35;
    }
    const ease = 1 - Math.exp(-.045 * dt);
    p.velocityX += (vx - p.velocityX) * ease; p.velocityY += (vy - p.velocityY) * ease;
    p.x += p.velocityX * dt; p.y += p.velocityY * dt;
  }
  private heldDot(p: Particle, sizeScale = 1) {
    // Subpixel-sized dots on pixel intersections otherwise become four grey pixels.
    // Align only settled cores; flying dust keeps continuous, unsnapped positions.
    const effectiveSize = p.size * sizeScale;
    const x = effectiveSize < 1 ? (Math.round(p.x * this.dpr - .5) + .5) / this.dpr : p.x;
    const y = effectiveSize < 1 ? (Math.round(p.y * this.dpr - .5) + .5) / this.dpr : p.y;
    // Chromium can cull tiny batched circles; keep a visible core at every DPR.
    const radius = Math.max(effectiveSize, .55 / this.dpr);
    this.ctx.moveTo?.(x + radius, y); this.ctx.arc(x, y, radius, 0, Math.PI * 2);
  }
  private drawDust(p: Particle, opacity = p.opacity, warmRatio = p.theme === 'warm' ? 1 : 0) {
    const radius = p.size * (2.1 + (1 - p.depth) * .9);
    if (warmRatio <= 0.01) {
      this.ctx.globalAlpha = opacity;
      this.ctx.drawImage(this.dustSpriteCool, p.x - radius, p.y - radius, radius * 2, radius * 2);
    } else if (warmRatio >= 0.99) {
      this.ctx.globalAlpha = opacity;
      this.ctx.drawImage(this.dustSprite, p.x - radius, p.y - radius, radius * 2, radius * 2);
    } else {
      this.ctx.globalAlpha = opacity * (1 - warmRatio);
      this.ctx.drawImage(this.dustSpriteCool, p.x - radius, p.y - radius, radius * 2, radius * 2);
      this.ctx.globalAlpha = opacity * warmRatio;
      this.ctx.drawImage(this.dustSprite, p.x - radius, p.y - radius, radius * 2, radius * 2);
    }
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
      const minX = layout.targets.length ? Math.min(...layout.targets.map(t => t.x)) : 0;
      const maxX = layout.targets.length ? Math.max(...layout.targets.map(t => t.x)) : 1;
      const xSpan = Math.max(1, maxX - minX);
      const isWriting = timeline.length > 0;
      this.textTargets = layout.targets.map(p => {
        const waveDelay = isWriting
          ? (timeline[p.glyph ?? 0] ?? 0)
          : ((p.x - minX) / xSpan) * 420 + ((p.glyph ?? 0) % 2) * 15;
        return {
          ...p,
          theme: 'warm' as const,
          delay: Math.max(0, waveDelay - elapsed),
        };
      });
      if (timeline.length) {
        const cursor = layout.cursors[0];
        if (cursor) this.textTargets.push(...createLineTargets(cursor.x + 3, cursor.y - layout.fontSize * .4, cursor.x + 3, cursor.y + layout.fontSize * .4, 2.4).map((p, i) => ({ ...p, key: `cursor-${i}`, size: .8, opacity: .8, theme: 'warm' as const })));
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
        if (particle.state !== 'FLOATING' || free++ < budget || particle.opacity >= .008) this.particles[retained++] = particle;
      }
      this.particles.length = retained;
      this.canvas.dataset.particleCount = String(this.particles.length);
      this.frameCount = 0; this.slowFrames = 0;
    }
    for (const waiter of this.waiters) if (this.time >= waiter.end) { this.waiters.delete(waiter); waiter.finish(); }
    const ctx = this.ctx; ctx.globalAlpha = 1; ctx.fillStyle = '#070605'; ctx.fillRect(0, 0, this.width, this.height); ctx.fillStyle = '#fff4df';
    let forming = 0, dispersing = 0, floating = 0;
    const ambient = this.ambientCount();
    for (const p of this.particles) {
      if (p.state === 'HOLDING') {
        const ease = this.reducedMotion ? 1 : Math.min(1, dt * .16);
        p.opacity += (p.targetOpacity - p.opacity) * ease;
        p.size += (p.targetSize - p.size) * ease;
        if (p.loop && !this.reducedMotion) {
          if (p.loop.type === 'rect' && p.loop.width && p.loop.height) {
            const { x, y, width, height, perimeter, offset, speed } = p.loop;
            let d = (offset + this.time * speed * 0.001) % perimeter;
            if (d < 0) d += perimeter;
            let px = x, py = y;
            if (d < width) {
              px = x + d; py = y;
            } else if (d < width + height) {
              px = x + width; py = y + (d - width);
            } else if (d < width * 2 + height) {
              px = x + width - (d - width - height); py = y + height;
            } else {
              px = x; py = y + height - (d - width * 2 - height);
            }
            p.targetX = px; p.targetY = py; p.x = px; p.y = py;
          } else if (p.loop.type === 'line' && p.loop.x2 !== undefined && p.loop.y2 !== undefined) {
            const { x, y, x2, y2, perimeter, offset, speed } = p.loop;
            if (perimeter > 0) {
              let d = (offset + this.time * speed * 0.001) % perimeter;
              if (d < 0) d += perimeter;
              const t = d / perimeter;
              const px = x + (x2 - x) * t, py = y + (y2 - y) * t;
              p.targetX = px; p.targetY = py; p.x = px; p.y = py;
            }
          }
        }
        continue;
      }
      if (p.state === 'FORMING' || p.state === 'MORPHING') {
        const age = this.time - p.activation;
        if (age < 0) {
          this.drift(p, dt); p.opacity += (.16 - p.opacity) * (1 - Math.exp(-.04 * dt));
          // The flight begins where the still-floating point is when its turn arrives.
          p.controlX += (p.x - p.fromX) / 2; p.controlY += (p.y - p.fromY) / 2;
          p.fromX = p.x; p.fromY = p.y;
          this.drawDust(p); continue;
        }
        forming++;
        const progress = Math.min(1, age / Math.max(1, p.duration));
        const t = smoothstep(progress);
        const anchorX = (1 - t) ** 2 * p.fromX + 2 * (1 - t) * t * p.controlX + t * t * p.targetX;
        const anchorY = (1 - t) ** 2 * p.fromY + 2 * (1 - t) * t * p.controlY + t * t * p.targetY;
        const dx = p.targetX - p.fromX;
        const dy = p.targetY - p.fromY;
        const dist = Math.hypot(dx, dy);
        const swirlEnvelope = Math.sin(t * Math.PI) * Math.pow(1 - t, 0.75);
        const swirlOffset = Math.sin(t * Math.PI * 2.2 + p.animationSeed * 6.28) * Math.min(45, dist * 0.2) * swirlEnvelope;
        const nx = dist > 0.001 ? -dy / dist : 0;
        const ny = dist > 0.001 ? dx / dist : 0;
        const prevX = p.x, prevY = p.y;
        p.x = anchorX + nx * swirlOffset;
        p.y = anchorY + ny * swirlOffset;
        if (dt > 0.001) {
          p.velocityX = (p.x - prevX) / dt;
          p.velocityY = (p.y - prevY) / dt;
        }
        p.opacity += (p.targetOpacity - p.opacity) * Math.min(1, .15 * dt);
        if (progress >= 1) {
          p.x = p.targetX; p.y = p.targetY;
          p.state = 'HOLDING';
          p.size = p.targetSize;
          p.softness = 0;
          p.opacity = p.targetOpacity;
          p.velocityX = p.velocityY = 0;
          p.impactGlow = this.time + 240;
        }
      } else {
        const visible = floating++ < ambient;
        const releasing = p.state === 'DISPERSING';
        if (!visible && !releasing && p.opacity < .008) continue;
        const progress = releasing ? smoothstep(Math.min(1, 1 - (p.release - this.time) / 1400)) : 1;
        this.drift(p, dt, releasing ? 1 - progress : 0);
        const inText = this.textBounds && p.x > this.textBounds.x && p.x < this.textBounds.right && p.y > this.textBounds.y && p.y < this.textBounds.bottom;
        const behindUI = this.exclusions.some(rect => p.x > rect.x - 8 && p.x < rect.right + 8 && p.y > rect.y - 7 && p.y < rect.bottom + 7);
        const opacity = visible ? (inText || behindUI ? .025 : p.ambientOpacity) : 0;
        const ease = 1 - Math.exp(-.05 * dt);
        p.opacity += (opacity - p.opacity) * ease;
        p.size += (p.ambientSize - p.size) * ease;
        p.softness += (1 - p.softness) * ease;
        if (releasing) { dispersing++; if (this.time >= p.release) p.state = 'FLOATING'; }
      }
      if (p.opacity < .008) continue;
      let warmRatio = p.theme === 'warm' ? 1 : 0;
      if (p.state === 'FORMING' || p.state === 'MORPHING') {
        const age = this.time - p.activation;
        const progress = Math.min(1, Math.max(0, age / Math.max(1, p.duration)));
        const t = smoothstep(progress);
        warmRatio = p.theme === 'warm' ? t : 0;
        p.size += (p.targetSize - p.size) * Math.min(1, .18 * dt);
        p.softness *= Math.exp(-.12 * dt);
      }
      if (p.softness > .01) this.drawDust(p, p.opacity * p.softness, warmRatio);
      if (p.softness < .99) {
        if (warmRatio > 0.01) {
          const r = Math.round(220 + (255 - 220) * warmRatio);
          const g = Math.round(230 + (226 - 230) * warmRatio);
          const b = Math.round(242 + (158 - 242) * warmRatio);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else {
          ctx.fillStyle = '#dce6f2';
        }
        ctx.globalAlpha = p.opacity * (1 - p.softness); ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
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
            p.fromX = p.x; p.fromY = p.y;
            p.controlX = (p.x + x) / 2; p.controlY = (p.y + y) / 2;
            p.targetX = x; p.targetY = y; p.state = 'MORPHING'; p.activation = this.time; p.duration = 80;
          }
          p.targetOpacity = this.time < cursorUntil && Math.floor((this.time - start) / 480) % 2 === 0 ? .8 : 0;
        }
        presentation.cursorCount = count;
      }
    }

    const uiHolding: Particle[] = [];
    const previewHolding: Particle[] = [];
    for (const p of this.assignments.values()) {
      if (p.state === 'HOLDING') {
        if (p.theme === 'cool' || p.isUI) uiHolding.push(p);
        else previewHolding.push(p);
      }
    }

    // 1. Cool silver UI pass (menus, boxes, buttons with organic breathing)
    ctx.fillStyle = '#dce6f2';
    for (const alpha of [.125, .25, .375, .5, .625, .75, .875, 1]) {
      ctx.globalAlpha = alpha; ctx.beginPath();
      for (const p of uiHolding) {
        const breath = this.reducedMotion ? 1 : (0.90 + 0.10 * Math.sin(this.time * 0.0022 + p.animationSeed * 6.28 + (p.targetX + p.targetY) * 0.003));
        const lineWave = p.loop?.type === 'line' && !this.reducedMotion ? (0.8 + 0.2 * Math.sin(this.time * 0.0035 - p.x * 0.035)) : 1;
        const currentOpacity = p.opacity * breath * lineWave;
        if (Math.round(currentOpacity * 8) / 8 === alpha && (!p.glow || p.targetOpacity < 1)) {
          const scale = p.sparkle && this.time < p.sparkle ? 1 + 0.35 * Math.sin((p.sparkle - this.time) / 350 * Math.PI) : 1;
          this.heldDot(p, scale);
        }
      }
      ctx.fill();
    }
    // Cool UI bloom for glowing controls
    ctx.globalAlpha = 1; ctx.beginPath();
    for (const p of uiHolding) if (p.glow && p.targetOpacity === 1) {
      const scale = p.sparkle && this.time < p.sparkle ? 1 + 0.35 * Math.sin((p.sparkle - this.time) / 350 * Math.PI) : 1;
      this.heldDot(p, scale);
    }
    ctx.shadowColor = '#c8d8ec30'; ctx.shadowBlur = 3; ctx.fill();
    ctx.shadowBlur = 0;

    // 2. Warm gold preview / message pass (radiant warm gold with glowing halo)
    ctx.fillStyle = '#ffe29e';
    for (const alpha of [.125, .25, .375, .5, .625, .75, .875, 1]) {
      ctx.globalAlpha = alpha; ctx.beginPath();
      for (const p of previewHolding) if (Math.round(p.opacity * 8) / 8 === alpha && (!p.glow || p.targetOpacity < 1)) {
        const impact = p.impactGlow && this.time < p.impactGlow ? 1 + 0.45 * Math.sin((p.impactGlow - this.time) / 240 * Math.PI) : 1;
        this.heldDot(p, impact);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.beginPath();
    for (const p of previewHolding) if ((p.glow && p.targetOpacity === 1) || (p.impactGlow && this.time < p.impactGlow)) {
      const impact = p.impactGlow && this.time < p.impactGlow ? 1 + 0.45 * Math.sin((p.impactGlow - this.time) / 240 * Math.PI) : 1;
      this.heldDot(p, impact);
    }
    ctx.shadowColor = '#f5b84c55'; ctx.shadowBlur = 5; ctx.fill();
    ctx.shadowBlur = 0; ctx.fill();

    // 3. Render cursor trail (stardust wake)
    if (this.trail.length > 0) {
      const remainingTrail: TrailParticle[] = [];
      for (const t of this.trail) {
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        t.vx *= Math.pow(0.97, dt);
        t.vy *= Math.pow(0.97, dt);
        t.life -= elapsed;
        if (t.life > 0) {
          remainingTrail.push(t);
          const progress = t.life / t.maxLife;
          ctx.globalAlpha = t.opacity * progress;
          ctx.fillStyle = '#e8f0fe';
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.size * progress, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      this.trail = remainingTrail;
    }

    // 4. Render hover sparks
    if (this.sparks.length > 0) {
      const remainingSparks: Spark[] = [];
      for (const spark of this.sparks) {
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
        spark.vx *= Math.pow(0.96, dt);
        spark.vy *= Math.pow(0.96, dt);
        spark.life -= elapsed;
        if (spark.life > 0) {
          remainingSparks.push(spark);
          const progress = spark.life / spark.maxLife;
          ctx.globalAlpha = spark.alpha * progress;
          ctx.fillStyle = spark.color;
          ctx.beginPath();
          ctx.arc(spark.x, spark.y, spark.size * Math.max(0.2, progress), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      this.sparks = remainingSparks;
    }

    // 5. Render typing flow particles (celestial arc from textfield to preview)
    if (this.flowParticles.length > 0) {
      const remainingFlow: FlowParticle[] = [];
      ctx.fillStyle = '#ffd885';
      for (const flow of this.flowParticles) {
        if (this.time < flow.startTime) {
          remainingFlow.push(flow);
          continue;
        }
        const age = this.time - flow.startTime;
        const progress = Math.min(1, age / flow.duration);
        const t = smoothstep(progress);

        const oneMinusT = 1 - t;
        flow.x = oneMinusT * oneMinusT * flow.startX + 2 * oneMinusT * t * flow.controlX + t * t * flow.endX;
        flow.y = oneMinusT * oneMinusT * flow.startY + 2 * oneMinusT * t * flow.controlY + t * t * flow.endY;

        if (progress < 1) {
          remainingFlow.push(flow);
          const alpha = flow.alpha * (progress < 0.1 ? progress * 10 : progress > 0.85 ? (1 - progress) / 0.15 : 1);
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(flow.x, flow.y, flow.size, 0, Math.PI * 2);
          ctx.fill();

          if (Math.random() > 0.65 && this.sparks.length < 50) {
            this.sparks.push({
              x: flow.x + (Math.random() - 0.5) * 3,
              y: flow.y + (Math.random() - 0.5) * 3,
              vx: (Math.random() - 0.5) * 0.3,
              vy: (Math.random() - 0.5) * 0.3,
              size: flow.size * 0.6,
              life: 220,
              maxLife: 220,
              color: '#ffeab3',
              alpha: 0.6,
            });
          }
        } else if (this.sparks.length < 50) {
          for (let s = 0; s < 2; s++) {
            this.sparks.push({
              x: flow.endX + (Math.random() - 0.5) * 10,
              y: flow.endY + (Math.random() - 0.5) * 10,
              vx: (Math.random() - 0.5) * 0.6,
              vy: (Math.random() - 0.5) * 0.6,
              size: flow.size * 0.8,
              life: 300,
              maxLife: 300,
              color: '#ffd885',
              alpha: 0.7,
            });
          }
        }
      }
      this.flowParticles = remainingFlow;
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
  triggerHoverSparks(rect: { x: number; y: number; width: number; height: number }, count = 16) {
    if (this.reducedMotion) return;
    const numSparks = Math.min(count, 24);
    for (let i = 0; i < numSparks; i++) {
      const side = Math.floor(Math.random() * 4);
      let x = rect.x, y = rect.y, nx = 0, ny = 0;
      if (side === 0) { x += Math.random() * rect.width; ny = -1; }
      else if (side === 1) { x += rect.width; y += Math.random() * rect.height; nx = 1; }
      else if (side === 2) { x += Math.random() * rect.width; y += rect.height; ny = 1; }
      else { y += Math.random() * rect.height; nx = -1; }
      const speed = 0.8 + Math.random() * 2.0;
      const angle = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.2;
      const maxLife = 350 + Math.random() * 300;
      this.sparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 0.8 + Math.random() * 1.1,
        life: maxLife,
        maxLife,
        color: Math.random() > 0.35 ? '#ffffff' : '#dce6f2',
        alpha: 0.9,
      });
    }
    for (const p of this.assignments.values()) {
      if (p.state === 'HOLDING' && p.x >= rect.x - 6 && p.x <= rect.x + rect.width + 6 && p.y >= rect.y - 6 && p.y <= rect.y + rect.height + 6) {
        p.sparkle = this.time + 350;
      }
    }
  }
  emitTypingFlow(fromRect?: DOMRect | null, toRect?: DOMRect | null) {
    if (this.reducedMotion) return;
    const source = fromRect ?? (typeof document !== 'undefined' ? document.querySelector('.text-field')?.getBoundingClientRect() : null);
    const target = toRect ?? (typeof document !== 'undefined' ? document.querySelector('.preview-bounds')?.getBoundingClientRect() : null);
    if (!source || !target) return;

    const count = 10 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const startX = source.right - 10 + (Math.random() - 0.5) * 16;
      const startY = source.top + source.height * (0.25 + Math.random() * 0.5);
      const endX = target.left + target.width * (0.2 + Math.random() * 0.6);
      const endY = target.top + target.height * (0.3 + Math.random() * 0.4);

      const midX = (startX + endX) / 2 + (Math.random() - 0.5) * 50;
      const arcHeight = Math.min(startY, endY) - 50 - Math.random() * 70;
      const controlX = midX;
      const controlY = arcHeight;

      const delay = i * 20 + Math.random() * 15;
      const duration = 560 + Math.random() * 220;

      this.flowParticles.push({
        startX, startY,
        controlX, controlY,
        endX, endY,
        x: startX, y: startY,
        startTime: this.time + delay,
        duration,
        size: 1.2 + Math.random() * 1.1,
        alpha: 0.95,
        seed: Math.random(),
      });
    }
  }
  destroy() {
    this.disposed = true; cancelAnimationFrame(this.frame); cancelAnimationFrame(this.refreshFrame);
    window.removeEventListener('resize', this.resize); window.removeEventListener('scroll', this.refresh);
    window.removeEventListener('pointermove', this.move); window.removeEventListener('pointerout', this.leave);
    document.removeEventListener('visibilitychange', this.visibility); this.motion.removeEventListener('change', this.changeMotion);
    this.waiters.forEach(waiter => waiter.abort()); this.waiters.clear();
    this.sparks = []; this.trail = []; this.flowParticles = [];
  }
}
