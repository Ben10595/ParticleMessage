import { seed } from '../particles/reveal';
import { SceneParticles, sampleLayout, secretBounds, shapeTargets, type SecretBounds } from '../particles/SceneParticles';
import type { Finale, GiftStyle, Secret } from '../types/experience';
import { graphemes, typingTimeline } from '../lib/playback';
import { DEFAULT_FONT, EFFECTS, type MessageFont, type TransitionEffect, type WritingSettings } from '../types/message';
import { clamp, contour, ease, measure, pointAt, type Point } from './geometry';
import { layoutLineText, type LineLayout } from './lineFont';
import { entranceDuration, entranceFrame, inkProgress, scheduleStrokes } from './writing';

export interface FormOptions { reserveSpace?: boolean; hold?: boolean; bounds?: () => DOMRect; writing?: WritingSettings; effect?: TransitionEffect; finale?: boolean; font?: MessageFont }
interface Entrance { start: number; x: number; y: number; size: number; index: number }
interface Strand { entrance?: Entrance; ink?: boolean; effect?: TransitionEffect; key: string; points: Point[]; lengths: number[]; length: number; start: number; duration: number; opacity: number; width: number; retract?: number; retractDuration?: number; from?: number; fromPoints?: Point[]; fromLengths?: number[]; movedAt?: number; fallback?: { char: string; size: number }; element?: HTMLElement }
interface Message { text: string; options: FormOptions; start: number; timeline: number[]; durations: number[]; layout: LineLayout; completion: number }
const RETRACT = 580;
/** Shared stroke rendering supplies contours and lettering. Native HTML
 * retains hit targets/semantics. Layout is captured on events, never per frame. */
export class OneLineEngine {
  width = 0; height = 0; time = 0; reducedMotion = false;
  private ctx: CanvasRenderingContext2D;
  private frame = 0; private refreshFrame = 0; private disposed = false; private lastFrame = 0;
  private root: HTMLElement | null = null;
  private strands = new Map<string, Strand>();
  private ids = new WeakMap<Element, number>(); private nextId = 0;
  private message: Message | null = null;
  private sceneParticles = new SceneParticles();
  private shape: Finale['shape'] | 'gift' | null = null;
  private activeSecret: Secret | null = null;
  private sceneClip: DOMRect | null = null;
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  private departing = false; private animateLayout = true;
  private hover: { rect: { x: number; y: number; width: number; height: number }; start: number } | null = null;
  private fpsTotal = 0; private fpsFrames = 0;
  private waiters = new Set<{ end: number; finish: () => void; abort: () => void }>();
  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas wird von deinem Browser nicht unterstützt.');
    this.ctx = ctx; this.reducedMotion = this.motion.matches;
    this.resize();
    this.canvas.dataset.renderer = 'particles';
    window.addEventListener('resize', this.resize);
    window.addEventListener('scroll', this.refresh, { passive: true, capture: true });
    document.addEventListener('visibilitychange', this.visibility);
    this.motion.addEventListener('change', this.changeMotion);
    this.frame = requestAnimationFrame(this.tick);
  }
  private resize = () => {
    this.width = window.innerWidth; this.height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * dpr); this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.refresh();
  };
  private visibility = () => { this.lastFrame = 0; };
  private changeMotion = () => { this.reducedMotion = this.motion.matches; this.refresh(); };
  refresh = () => {
    if (this.disposed || this.refreshFrame) return;
    this.refreshFrame = requestAnimationFrame(() => {
      this.refreshFrame = 0; this.animateLayout = false;
      if (this.root?.isConnected && !this.departing) this.captureUI();
      if (this.message) { this.layoutMessage(this.message, true); if (this.activeSecret) this.revealSecret(this.activeSecret); }
      else if (this.shape) this.sceneParticles.form(shapeTargets(this.shape, this.width, this.height), this.time, 'morph', 1000, this.width, this.height, false, true);
      this.animateLayout = true;
    });
  };
  private put(key: string, points: Point[], start: number, duration: number, opacity = .62, width = 1, element?: HTMLElement, fallback?: Strand['fallback'], ink = false, effect?: TransitionEffect, entrance?: Entrance) {
    const old = this.strands.get(key), metrics = measure(points);
    const moved = this.animateLayout && old && old.points.length === points.length && old.points.some((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y) > .5);
    this.strands.set(key, { key, ink, effect, entrance, points, ...metrics, start: old && old.retract === undefined ? old.start : start, duration: old && old.retract === undefined ? old.duration : duration, opacity, width, element, fallback,
      fromPoints: this.animateLayout ? moved ? old.points : old?.fromPoints : undefined, fromLengths: moved ? old.lengths : old?.fromLengths, movedAt: moved ? this.time : old?.movedAt });
  }
  private progress(s: Strand) {
    if (this.reducedMotion) return s.retract === undefined ? 1 : 0;
    if (s.retract !== undefined) return (s.from ?? 1) * (1 - ease((this.time - s.retract) / (s.retractDuration ?? RETRACT)));
    if (s.entrance && (s.effect === 'typewriter' || s.effect === 'fade')) return this.time >= s.entrance.start ? 1 : 0;
    const progress = (this.time - s.start) / Math.max(1, s.duration);
    return s.ink ? inkProgress(progress, s.effect) : ease(progress);
  }
  private retract(s: Strand, delay = 0, duration = RETRACT) {
    if (s.retract !== undefined) return;
    s.from = this.progress(s); s.retract = this.time + delay; s.retractDuration = duration;
  }
  private windBack(strands: Strand[]) {
    strands.reverse().forEach((s, index) => this.retract(s, this.reducedMotion ? 0 : index / Math.max(1, strands.length) * 320, 260));
  }
  formUI(root: HTMLElement) {
    this.root = root; this.departing = false; this.captureUI();
  }
  private captureUI() {
    if (!this.root) return;
    const seen = new Set<string>(); let order = 0;
    const add = (key: string, points: Point[], duration: number, opacity: number, width: number, element: HTMLElement, delay = 0, fallback?: Strand['fallback'], ink = false) => {
      seen.add(key); this.put(key, points, this.time + delay, duration, opacity, width, element, fallback, ink);
    };
    const elements = this.root.querySelectorAll<HTMLElement>('[data-particle]');
    for (const el of elements) {
      if (el.closest('[data-particle-overlay], .emoji-picker') || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      let id = this.ids.get(el); if (id === undefined) { id = this.nextId++; this.ids.set(el, id); }
      const key = `ui-${id}`, kind = el.dataset.particle;
      const opacity = el.matches(':disabled') ? .16 : el.matches(':focus-within, :hover, [aria-current], :checked') ? .95 : .45;
      const isHero = kind === 'hero', isPrimary = el.classList.contains('primary') && !el.closest('.editor-bottom');
      const delay = this.reducedMotion ? 0 : Number(el.dataset.particleDelay ?? Math.min(order++ * 24, 260));
      if (isHero || isPrimary || el.classList.contains('brand-heart')) {
        const style = getComputedStyle(el), fontSize = parseFloat(style.fontSize);
        const box = isPrimary ? { x: rect.x + 16, y: rect.y + 10, width: rect.width - 32, height: rect.height - 20 } : rect;
        const layout = layoutLineText(el.textContent ?? '', box, isPrimary ? fontSize : fontSize * .92, style.textAlign === 'left' || el.closest('.editor-heading') ? 'left' : 'center');
        const glyphDelay = isHero ? 90 : 38;
        for (const g of layout.glyphs) {
          const strokes = scheduleStrokes(g.paths, glyphDelay * .92);
          g.paths.forEach((path, index) => add(`${key}-g${g.index}-${index}`, path, strokes[index].duration, el.classList.contains('brand-heart') ? .5 : 1, isHero ? Math.max(1.05, layout.fontSize / 60) : 1, el, delay + g.index * glyphDelay + strokes[index].offset, undefined, true));
          if (g.fallback) add(`${key}-g${g.index}-emoji`, [{ x: g.x, y: g.y }], glyphDelay * .92, 1, 1, el, delay + g.index * glyphDelay, { char: g.char, size: layout.fontSize });
        }
      }
      if (['frame', 'button', 'control', 'switch'].includes(kind ?? '')) {
        add(key, contour(rect.x, rect.y, rect.width, rect.height, kind === 'switch' ? 12 : isPrimary ? 28 : 3), 620, opacity, 1, el, delay);
        if (kind === 'switch') {
          const checked = (el as HTMLInputElement).checked;
          add(`${key}-thumb`, contour(rect.x + (checked ? rect.width - 18 : 6), rect.y + 6, 12, 12, 6), 340, checked ? 1 : .5, 1.3, el);
        }
      }
      if (kind === 'line') add(key, [{ x: rect.left, y: rect.top }, { x: rect.right, y: rect.top }], 650, .22, 1, el, delay);
      if (kind === 'range') {
        const input = el as HTMLInputElement, fraction = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
        add(key, [{ x: rect.x, y: rect.y + rect.height / 2 }, { x: rect.right, y: rect.y + rect.height / 2 }], 500, .32, 1, el);
        add(`${key}-thumb`, contour(rect.x + (rect.width - 10) * fraction, rect.y + rect.height / 2 - 5, 10, 10, 5), 250, 1, 1, el);
      }
    }
    for (const [key, s] of this.strands) if (key.startsWith('ui-') && !seen.has(key)) this.retract(s);
    this.stats();
  }
  departUI(root: HTMLElement) {
    this.root = root; this.departing = true; this.message = null; this.shape = null; this.activeSecret = null; this.sceneParticles.disperse(this.time, this.width, this.height, .4);
    this.windBack([...this.strands.values()]);
    this.canvas.dataset.phase = 'dispersing';
  }
  formText(text: string, options: FormOptions | boolean = {}): number {
    this.shape = null; this.activeSecret = null;
    const opts = typeof options === 'boolean' ? {} : { ...options };
    if (opts.effect === 'random') {
      const choices = EFFECTS.filter(effect => effect !== 'random');
      opts.effect = choices[Math.floor(Math.random() * choices.length)];
    }
    const previous = [...this.strands.values()].filter(s => s.key.startsWith('text-'));
    for (const s of previous) {
      this.strands.delete(s.key); s.key = `out-${s.key}-${this.time}`; this.strands.set(s.key, s);
    }
    this.windBack(previous);
    const start = this.time + (this.reducedMotion ? 0 : previous.length ? RETRACT + 100 : 260);
    const characters = graphemes(text);
    const typing = opts.writing?.enabled && !this.reducedMotion;
    const drawTime = opts.finale ? 1400 : 900;
    const timeline = typing ? typingTimeline(text, opts.writing!) : characters.map((_, index) => index * drawTime / Math.max(1, characters.length));
    const durations = timeline.map((at, index) => {
      const slot = timeline[index + 1] === undefined ? (typing ? opts.writing!.speed : drawTime / Math.max(1, characters.length)) : timeline[index + 1] - at;
      // A pause belongs after the completed glyph, not inside its pen strokes.
      return this.reducedMotion ? 0 : Math.max(1, Math.min(slot, typing ? opts.writing!.speed : slot) * .92);
    });
    const completion = this.reducedMotion ? 0 : (timeline.at(-1) ?? 0) + 700 + 120;
    const message: Message = { text, options: opts, start, timeline, durations, layout: { glyphs: [], fontSize: 0, lineCount: 0, height: 0 }, completion };
    this.message = message; this.layoutMessage(message); this.canvas.dataset.phase = this.reducedMotion ? 'holding' : 'forming';
    return this.reducedMotion ? 0 : start - this.time + completion;
  }
  private layoutMessage(message: Message, refresh = false) {
    const rect = message.options.bounds?.();
    this.sceneClip = rect ?? null;
    const box = rect ?? { x: this.width * .09, y: this.height * .2, width: this.width * .82, height: this.height * (message.options.reserveSpace ? .44 : .6) };
    const layout = message.layout = layoutLineText(message.text, box, Math.min(rect ? 48 : 96, box.width / (rect ? 7 : 9)), 'center', message.options.font);
    const targets = sampleLayout(layout).map((target, i) => {
      let delay = message.timeline[target.glyph] ?? 0;
      if (!message.options.writing?.enabled) {
        if (message.options.effect === 'sweep') delay = (target.x - box.x) / box.width * 900;
        else if (message.options.effect === 'collect') delay = seed(i) * 900;
        else if (message.options.effect === 'wave') delay = (target.x - box.x) / box.width * 550;
        else if (!['morph', 'typewriter'].includes(message.options.effect ?? 'morph')) delay = seed(i) * 160;
      }
      return { ...target, delay: message.options.hold || this.reducedMotion ? 0 : delay };
    });
    this.sceneParticles.form(targets, message.start, message.options.effect ?? 'morph', this.reducedMotion ? 0 : 700, this.width, this.height, message.options.hold, refresh);
    this.canvas.dataset.textFont = message.options.font ?? DEFAULT_FONT;
    this.canvas.dataset.textEffect = message.options.effect ?? 'morph';
    this.canvas.dataset.textFontSize = String(layout.fontSize); this.canvas.dataset.textLineCount = String(layout.lineCount); this.stats();
  }
  disperseText(_strength = .8) {
    this.shape = null; this.activeSecret = null; this.sceneParticles.disperse(this.time, this.width, this.height, _strength); this.message = null;
    this.windBack([...this.strands.values()].filter(s => s.key.startsWith('text-') || s.key.startsWith('out-')));
    this.canvas.dataset.phase = 'dispersing';
  }
  loosenText() { this.disperseText(); }
  disperseParticles(_strength = 1) {
    this.shape = null; this.activeSecret = null; this.sceneParticles.disperse(this.time, this.width, this.height, _strength); this.message = null; this.root = null; this.departing = true;
    this.windBack([...this.strands.values()]);
    this.canvas.dataset.phase = 'dispersing';
  }
  get holdProgress() { return this.sceneParticles.holdProgress; }
  setHeld(pressed: boolean) { this.sceneParticles.setPressed(pressed, this.reducedMotion); }
  setTilt(x: number, y: number) { this.sceneParticles.setTilt(x, y); }
  formShape(shape: Finale['shape'] | 'gift') {
    this.message = null; this.sceneClip = null; this.shape = shape;
    this.sceneParticles.form(shapeTargets(shape, this.width, this.height), this.time, 'spiral', this.reducedMotion ? 0 : 1100, this.width, this.height);
    this.canvas.dataset.textTargetCount = String(this.sceneParticles.count);
    return this.reducedMotion ? 0 : 1100;
  }
  openGift(style: GiftStyle) { this.sceneParticles.openGift(this.time, style); }
  floatFinale() { this.sceneParticles.float(); }
  getSecretBounds(secrets: Secret[]): SecretBounds[] { return this.message ? secretBounds(this.message.layout, this.message.text, secrets) : []; }
  revealSecret(secret: Secret) {
    const message = this.message;
    if (!message) return;
    this.activeSecret = secret;
    let offset = 0;
    const selected = new Set<number>();
    for (const g of message.layout.glyphs) { if (offset >= secret.start && offset < secret.end) selected.add(g.index); offset += g.char.length; }
    const rect = message.options.bounds?.();
    const box = rect ? { x: rect.x + 10, y: rect.y + rect.height * .64, width: rect.width - 20, height: rect.height * .36 } : { x: this.width * .1, y: this.height * .67, width: this.width * .8, height: this.height * .17 };
    const layout = layoutLineText(secret.text, box, Math.min(rect ? 24 : 40, box.width / 15), 'center', message.options.font);
    this.sceneParticles.revealSubset(selected, sampleLayout(layout), this.time);
  }
  restoreSecret() { this.activeSecret = null; if (this.message) this.sceneParticles.restoreSubset(sampleLayout(this.message.layout), this.time); }
  triggerHoverSparks(rect: { x: number; y: number; width: number; height: number }) {
    if (!this.reducedMotion) this.hover = { rect, start: this.time };
  }
  emitTypingFlow(rect?: DOMRect, _target?: DOMRect | null) { void _target; if (rect) this.triggerHoverSparks(rect); }
  private stats() {
    let ui = 0, text = this.sceneParticles.count;
    for (const s of this.strands.values()) { if (s.key.startsWith('ui-')) ui += s.points.length; if (s.key.startsWith('text-')) text += s.points.length; }
    this.canvas.dataset.uiTargetCount = String(ui); this.canvas.dataset.textTargetCount = String(text);
    this.canvas.dataset.linePointCount = String(ui + text);
  }
  private trace(s: Strand, progress: number, alpha = s.opacity) {
    const ctx = this.ctx;
    const entrance = s.entrance;
    const motion = entranceFrame(s.effect, !entrance || this.reducedMotion ? 1 : (this.time - entrance.start) / Math.max(1, entranceDuration(s.effect)), entrance?.index);
    const transform = (p: Point): Point => {
      if (!entrance) return p;
      const x = (p.x - entrance.x) * motion.scale, y = (p.y - entrance.y) * motion.scale;
      return { x: entrance.x + x * Math.cos(motion.rotation) - y * Math.sin(motion.rotation) + motion.x * entrance.size, y: entrance.y + x * Math.sin(motion.rotation) + y * Math.cos(motion.rotation) + motion.y * entrance.size };
    };
    alpha *= motion.opacity;
    const moving = !this.reducedMotion && s.fromPoints && s.movedAt !== undefined && this.time - s.movedAt < 500;
    const blend = moving ? 1 - Math.exp(-7 * clamp((this.time - s.movedAt!) / 500)) * Math.cos(clamp((this.time - s.movedAt!) / 500) * 7) : 1;
    const position = (p: Point, i: number): Point => moving ? { x: s.fromPoints![i].x + (p.x - s.fromPoints![i].x) * blend, y: s.fromPoints![i].y + (p.y - s.fromPoints![i].y) * blend } : p;
    if (s.fallback) {
      const p = transform(s.points[0]);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(motion.rotation);
      ctx.globalAlpha = alpha * progress; ctx.font = `${s.fallback.size * motion.scale}px -apple-system, sans-serif`; ctx.textBaseline = 'top'; ctx.fillStyle = '#f2f2ed';
      ctx.fillText(s.fallback.char, 0, 0); ctx.restore(); return p;
    }
    const distance = s.length * progress;
    let tip = pointAt(s.points, s.lengths, distance);
    if (moving && s.fromLengths) {
      const oldTip = pointAt(s.fromPoints!, s.fromLengths, (s.fromLengths.at(-1) ?? 0) * progress);
      tip = { x: oldTip.x + (tip.x - oldTip.x) * blend, y: oldTip.y + (tip.y - oldTip.y) * blend };
    }
    tip = transform(tip);
    ctx.globalAlpha = alpha; ctx.lineWidth = s.width; ctx.beginPath(); const first = transform(position(s.points[0], 0)); ctx.moveTo(first.x, first.y);
    for (let i = 1; i < s.points.length && s.lengths[i] < distance; i++) { const p = transform(position(s.points[i], i)); ctx.lineTo(p.x, p.y); }
    ctx.lineTo(tip.x, tip.y); ctx.setLineDash?.([.01, Math.max(2.8, s.width * 2.7)]); ctx.stroke(); ctx.setLineDash?.([]); return tip;
  }
  private tick = (now: number) => {
    if (this.disposed) return;
    const elapsed = this.lastFrame && !document.hidden ? Math.min(50, now - this.lastFrame) : 16.67;
    this.lastFrame = now;
    if (document.hidden) { this.frame = requestAnimationFrame(this.tick); return; }
    this.time += elapsed;
    const ctx = this.ctx; ctx.globalAlpha = 1; ctx.fillStyle = '#060708'; ctx.fillRect(0, 0, this.width, this.height);
    ctx.strokeStyle = '#f4f4ee'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    let tip: Point | undefined, latestStart = -Infinity, drawing = false;
    const visible: { strand: Strand; progress: number }[] = [];
    for (const [key, s] of this.strands) {
      const progress = this.progress(s);
      if (s.retract !== undefined && progress <= .0001) { this.strands.delete(key); continue; }
      if (progress <= 0) continue;
      visible.push({ strand: s, progress });
      if (progress < 1 || s.retract !== undefined) drawing = true;
    }
    for (const { strand, progress } of visible) {
      const end = this.trace(strand, progress);
      if (strand.ink && !strand.fallback && strand.retract === undefined && progress < 1 && strand.start > latestStart) { tip = end; latestStart = strand.start; }
    }
    if (tip && drawing && !this.reducedMotion) {
      // The only writing cursor is the tip of the stroke currently being drawn.
      // It lifts between strokes and never leaves a bar or connecting trail.
      ctx.shadowBlur = 5; ctx.shadowColor = '#f4f4ee'; ctx.globalAlpha = .65;
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 1.05, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowBlur = 0;
    }
    if (this.hover) {
      const progress = (this.time - this.hover.start) / 900;
      if (progress >= 1) this.hover = null;
      else {
        const r = this.hover.rect, points = contour(r.x, r.y, r.width, r.height, 4), m = measure(points);
        ctx.globalAlpha = Math.sin(progress * Math.PI) * .9; ctx.lineWidth = 1.4; ctx.beginPath();
        for (let i = 0; i < 16; i++) { const p = pointAt(points, m.lengths, ((progress + i * .003) % 1) * m.length); if (!i) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); } ctx.stroke();
      }
    }
    if (this.sceneClip) { ctx.save(); ctx.beginPath(); ctx.rect?.(this.sceneClip.x, this.sceneClip.y, this.sceneClip.width, this.sceneClip.height); ctx.clip?.(); }
    this.sceneParticles.draw(ctx, this.time, elapsed, this.width, this.height, this.reducedMotion);
    if (this.sceneClip) ctx.restore();
    this.canvas.dataset.holdProgress = this.sceneParticles.holdProgress.toFixed(3);
    if (this.message) {
      const message = this.message, elapsed = this.time - message.start;
      const visible = this.reducedMotion ? message.layout.glyphs.length : message.timeline.filter(time => time <= elapsed).length;
      this.canvas.dataset.visibleCharacters = String(visible);
      this.canvas.dataset.phase = message.options.hold ? this.sceneParticles.holdProgress >= 1 ? 'holding' : 'revealing' : elapsed >= message.completion || this.reducedMotion ? 'holding' : 'forming';
    } else if (this.sceneParticles.dispersing) this.canvas.dataset.phase = 'dispersing';
    else if (!drawing && !this.departing) this.canvas.dataset.phase = 'holding';
    for (const waiter of this.waiters) if (this.time >= waiter.end) waiter.finish();
    this.fpsTotal += elapsed; this.fpsFrames++;
    if (this.fpsFrames >= 60) { this.canvas.dataset.fps = String(Math.round(1000 * this.fpsFrames / this.fpsTotal)); this.fpsFrames = this.fpsTotal = 0; }
    this.frame = requestAnimationFrame(this.tick);
  };
  wait(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.disposed || signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
      const cleanup = () => { this.waiters.delete(waiter); signal?.removeEventListener('abort', waiter.abort); };
      const waiter = { end: this.time + ms, finish: () => { cleanup(); resolve(); }, abort: () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); } };
      this.waiters.add(waiter); signal?.addEventListener('abort', waiter.abort, { once: true });
    });
  }
  destroy() {
    if (this.disposed) return; this.disposed = true;
    cancelAnimationFrame(this.frame); cancelAnimationFrame(this.refreshFrame);
    window.removeEventListener('resize', this.resize); window.removeEventListener('scroll', this.refresh, true);
    document.removeEventListener('visibilitychange', this.visibility); this.motion.removeEventListener('change', this.changeMotion);
    for (const waiter of this.waiters) waiter.abort();
    this.strands.clear(); this.sceneParticles.clear(); this.root = null; this.message = null;
  }
}
