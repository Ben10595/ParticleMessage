import { createTextTargets } from './textSampler';
import { createButtonTargets, createLineTargets, createRectangleTargets, type Target } from './targetGenerators';
export type ParticleState = 'FLOATING' | 'FORMING' | 'HOLDING' | 'DISPERSING';
export interface Particle {
  x: number; y: number; targetX: number; targetY: number; velocityX: number; velocityY: number;
  size: number; opacity: number; idleOffset: number; phase: number; speed: number; spring: number;
  state: ParticleState; activation: number; release: number; targetOpacity: number; targetSize: number;
}
export class ParticleEngine {
  readonly particles: Particle[] = [];
  width = 0; height = 0; time = 0; reducedMotion = false;
  private ctx: CanvasRenderingContext2D;
  private frame = 0; private lastFrame = 0; private disposed = false;
  private pointer = { x: -1000, y: -1000 };
  private scene: (() => Target[]) | null = null;
  private assignments = new Map<string, Particle>();
  private elementKeys = new WeakMap<HTMLElement, string>();
  private nextElementKey = 0;
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  private slowFrames = 0; private frameCount = 0; private performanceScale = 1;
  private waiters = new Set<{ end: number; finish: () => void }>();
  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas wird von deinem Browser nicht unterstützt.');
    this.ctx = ctx; this.reducedMotion = this.motion.matches;
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
  private move = (event: PointerEvent) => { this.pointer.x = event.clientX; this.pointer.y = event.clientY; };
  private leave = () => { this.pointer.x = -1000; this.pointer.y = -1000; };
  private makeParticle(): Particle {
    return { x: Math.random() * this.width, y: Math.random() * this.height, targetX: 0, targetY: 0,
      velocityX: 0, velocityY: 0, size: .55 + Math.random() * .65, opacity: .1 + Math.random() * .3,
      idleOffset: Math.random() * Math.PI * 2, phase: Math.random() * 10, speed: .4 + Math.random() * .7,
      spring: .016 + Math.random() * .025, state: 'FLOATING', activation: 0, release: 0, targetOpacity: .9, targetSize: 1 };
  }
  private desiredCount() {
    const mobile = this.width < 700;
    return Math.round(Math.min(mobile ? 1800 : 3500, Math.max(mobile ? 1800 : 2200, this.width * this.height / 260)) * this.performanceScale);
  }
  private resize = () => {
    this.width = window.innerWidth; this.height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * dpr); this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = this.desiredCount();
    while (this.particles.length < count) this.particles.push(this.makeParticle());
    if (this.particles.length > count) this.particles.length = count;
    this.refresh();
  };
  refresh = () => { if (this.scene && !this.disposed) this.setParticleTargets(this.scene(), false); };
  setParticleTargets(targets: Target[], animate = true) {
    // Dense editor text needs extra points to remain legible. Grow the shared pool
    // on demand, never per element or per frame; keep the extra particles for reuse.
    const capacity = Math.round((this.width < 700 ? 4200 : 6000) * this.performanceScale);
    const required = Math.min(capacity, Math.max(this.desiredCount(), targets.length + 200));
    while (this.particles.length < required) this.particles.push(this.makeParticle());
    this.canvas.dataset.particleCount = String(this.particles.length);
    this.canvas.dataset.targetCount = String(targets.length);
    const budget = this.particles.length - 200;
    const selected = targets.length > budget ? Array.from({ length: budget }, (_, i) => targets[Math.floor(i * targets.length / budget)]) : targets;
    const available = new Set(this.particles);
    const nextAssignments = new Map<string, Particle>();
    // Keep unchanged UI points on the same particles when editing or copying a link.
    selected.forEach((target, i) => {
      const key = target.key ?? `point-${i}`;
      const existing = this.assignments.get(key);
      if (existing && available.has(existing)) { nextAssignments.set(key, existing); available.delete(existing); }
    });
    selected.forEach((target, i) => {
      const key = target.key ?? `point-${i}`;
      let p = nextAssignments.get(key);
      if (!p) { p = available.values().next().value!; available.delete(p); nextAssignments.set(key, p); }
      p.targetX = target.x; p.targetY = target.y; p.targetOpacity = target.opacity ?? .9; p.targetSize = target.size ?? 1;
      p.activation = this.time + (animate && !this.reducedMotion ? target.delay ?? Math.random() * 250 : 0);
      p.state = 'FORMING';
      if (this.reducedMotion) { p.state = 'HOLDING'; p.x = p.targetX; p.y = p.targetY; p.velocityX = 0; p.velocityY = 0; }
    });
    available.forEach(p => { if (p.state === 'FORMING' || p.state === 'HOLDING') this.releaseParticle(p); });
    this.assignments = nextAssignments;
    this.canvas.dataset.phase = this.reducedMotion ? 'holding' : 'forming';
  }
  private releaseParticle(p: Particle) {
    p.state = 'DISPERSING'; p.release = this.time + 1100 + Math.random() * 800;
    const angle = p.idleOffset + this.time * .0001;
    p.velocityX = Math.cos(angle) * (1.2 + p.speed); p.velocityY = Math.sin(angle) * (1.2 + p.speed);
    if (this.reducedMotion) { p.x = Math.random() * this.width; p.y = Math.random() * this.height; p.opacity = .2; p.state = 'FLOATING'; }
  }
  disperseParticles() { this.scene = null; this.assignments.clear(); this.canvas.dataset.phase = 'dispersing'; this.particles.forEach(p => { if (p.state !== 'FLOATING' && p.state !== 'DISPERSING') this.releaseParticle(p); }); }
  formText(text: string, preview = false) {
    this.scene = () => createTextTargets(text, { x: this.width * .08, y: this.height * .2, width: this.width * .84, height: this.height * .6, fontSize: Math.min(this.width < 700 ? 56 : 96, this.width / 9), fit: true, weight: 500 }).concat(preview ? createTextTargets('×', { x: this.width - (this.width < 700 ? 58 : 72), y: this.width < 700 ? 10 : 20, width: 48, height: 48, fontSize: 28, opacity: .5 }) : []);
    this.setParticleTargets(this.scene());
  }
  formUI(root: HTMLElement, animate = true, skipTransient = false) {
    this.scene = () => {
      const targets: Target[] = [];
      root.querySelectorAll<HTMLElement>('[data-particle]').forEach(element => {
        if (skipTransient && element.hasAttribute('data-transient')) return;
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > this.height) return;
        const style = getComputedStyle(element);
        let elementKey = this.elementKeys.get(element);
        if (!elementKey) { elementKey = `element-${this.nextElementKey++}`; this.elementKeys.set(element, elementKey); }
        const append = (points: Target[], kind: string) => targets.push(...points.map((point, i) => ({ ...point, key: `${elementKey}-${kind}-${i}` })));
        const opacity = element.closest('[disabled]') ? .24 : Number(element.dataset.opacity ?? .9);
        if (element.dataset.particle === 'line') { append(createLineTargets(rect.x, rect.y, rect.right, rect.y), 'line'); return; }
        if (element.dataset.particle === 'box' || element.dataset.particle === 'button') {
          const generator = element.dataset.particle === 'button' ? createButtonTargets : createRectangleTargets;
          append(generator(rect.x, rect.y, rect.width, rect.height).map(p => ({ ...p, opacity: opacity * .55 })), 'border');
        }
        if (element.dataset.particle === 'box') return;
        const input = element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement;
        const text = input ? element.value || element.placeholder : element.dataset.text ?? element.textContent ?? '';
        const paddingX = parseFloat(style.paddingLeft) || 0;
        const paddingY = parseFloat(style.paddingTop) || 0;
        const textTargets = createTextTargets(text, { x: rect.x + paddingX, y: rect.y + paddingY - (input ? element.scrollTop : 0), width: rect.width - paddingX - (parseFloat(style.paddingRight) || 0), height: input ? Math.max(element.scrollHeight, rect.height) : rect.height - paddingY - (parseFloat(style.paddingBottom) || 0), fontSize: parseFloat(style.fontSize), weight: parseInt(style.fontWeight) || 400, align: style.textAlign === 'center' ? 'center' : 'left', fit: !input, verticalAlign: input ? 'top' : 'center', opacity: input && !element.value ? .45 : opacity });
        append(input ? textTargets.filter(point => point.y >= rect.y && point.y < rect.bottom) : textTargets, 'text');
      });
      return targets;
    };
    this.setParticleTargets(this.scene(), animate);
  }
  wait(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted || this.disposed) { reject(new DOMException('Aborted', 'AbortError')); return; }
      const cleanup = () => signal?.removeEventListener('abort', abort);
      const waiter = { end: this.time + ms, finish: () => { cleanup(); resolve(); } };
      const abort = () => { this.waiters.delete(waiter); cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
      signal?.addEventListener('abort', abort, { once: true }); this.waiters.add(waiter);
    });
  }
  private tick = (now: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
    if (document.hidden) { this.lastFrame = 0; return; }
    const elapsed = this.lastFrame ? now - this.lastFrame : 16.67; this.lastFrame = now;
    const dt = Math.min(elapsed / 16.67, 2); this.time += Math.min(elapsed, 50);
    if (++this.frameCount < 240 && elapsed > 28) this.slowFrames++;
    if (this.frameCount === 240 && this.slowFrames > 80 && this.performanceScale === 1) { this.performanceScale = .8; this.resize(); }
    for (const waiter of this.waiters) if (this.time >= waiter.end) { this.waiters.delete(waiter); waiter.finish(); }
    const ctx = this.ctx; ctx.fillStyle = '#06080b'; ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#d8e6ee';
    let forming = 0, dispersing = 0;
    for (const p of this.particles) {
      const formed = (p.state === 'FORMING' || p.state === 'HOLDING') && this.time >= p.activation;
      if (!this.reducedMotion) {
        if (formed) {
          const dx = p.targetX + Math.sin(this.time * .00065 + p.phase) * .23 - p.x;
          const dy = p.targetY + Math.cos(this.time * .0007 + p.phase) * .23 - p.y;
          p.velocityX = (p.velocityX + dx * p.spring * dt) * Math.pow(.76, dt);
          p.velocityY = (p.velocityY + dy * p.spring * dt) * Math.pow(.76, dt);
          if (Math.abs(dx) + Math.abs(dy) < 1.5) p.state = 'HOLDING';
        } else {
          p.velocityX += Math.sin(this.time * .00025 * p.speed + p.idleOffset) * .009 * dt;
          p.velocityY += Math.cos(this.time * .00022 * p.speed + p.phase) * .009 * dt;
          const damping = p.state === 'DISPERSING' ? .991 : .98;
          p.velocityX *= Math.pow(damping, dt); p.velocityY *= Math.pow(damping, dt);
          if (p.state === 'DISPERSING' && this.time > p.release) p.state = 'FLOATING';
        }
        const dx = p.x - this.pointer.x, dy = p.y - this.pointer.y, dist2 = dx * dx + dy * dy;
        if (dist2 < 6400 && dist2 > 1) {
          const dist = Math.sqrt(dist2), force = (1 - dist / 80) * (formed ? .025 : .16);
          p.velocityX += dx / dist * force * dt; p.velocityY += dy / dist * force * dt;
        }
        p.x += p.velocityX * dt; p.y += p.velocityY * dt;
        if (!formed) { if (p.x < -30) p.x = this.width + 25; if (p.x > this.width + 30) p.x = -25; if (p.y < -30) p.y = this.height + 25; if (p.y > this.height + 30) p.y = -25; }
      }
      if (p.state === 'FORMING') forming++;
      if (p.state === 'DISPERSING') dispersing++;
      const alpha = formed ? p.targetOpacity : .12 + p.speed * .18;
      p.opacity += (alpha - p.opacity) * .06 * dt;
      const size = formed ? p.targetSize : p.size;
      ctx.globalAlpha = p.opacity;
      ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const phase = forming ? 'forming' : this.assignments.size ? 'holding' : dispersing ? 'dispersing' : 'floating';
    if (this.canvas.dataset.phase !== phase) this.canvas.dataset.phase = phase;
  };
  destroy() {
    this.disposed = true; cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.resize); window.removeEventListener('scroll', this.refresh);
    window.removeEventListener('pointermove', this.move); window.removeEventListener('pointerout', this.leave);
    document.removeEventListener('visibilitychange', this.visibility); this.motion.removeEventListener('change', this.changeMotion);
    this.waiters.forEach(waiter => waiter.finish()); this.waiters.clear();
  }
}
