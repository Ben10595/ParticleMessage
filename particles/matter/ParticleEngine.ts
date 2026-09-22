import { graphemes, typingTimeline } from '../../lib/playback';
import { DEFAULT_FONT, DEFAULT_PARTICLE_STYLE, EFFECTS, type MessageSettings } from '../../types/message';
import type { Finale, GiftStyle, Secret } from '../../types/experience';
import { advanceHold } from '../reveal';
import { contour, measure, pointAt } from '../../lines/geometry';
import { ParticlePool } from './MorphSystem';
import { ParticleRenderer } from './ParticleRenderer';
import { TextSampler } from './TextSampler';
import { sampleShape } from './ShapeSampler';
import { InteractionSystem } from './InteractionSystem';
import { stepPhysics, type PhysicsOptions } from './PhysicsSystem';
import { QualityManager } from './QualityManager';
import { MOTION_TIMING, response } from './motion';
import { COLORS, type Box, type FormOptions, type Sample, type Target } from './types';
export type { FormOptions } from './types';
interface Message { text: string; options: FormOptions; start: number; timeline: number[]; duration: number; completion: number; sample: Sample }
interface Waiter { end: number; finish: () => void; abort: () => void }
const UI = 1, SCENE = 2, SECRET = 3;
/** Sole animation owner for the whole application. Scenes, UI and ambient matter share IDs. */
export class ParticleEngine {
  width = 1; height = 1; time = 0; reducedMotion = false;
  private renderer: ParticleRenderer;
  private sampler = new TextSampler();
  private pool: ParticlePool;
  private interaction: InteractionSystem;
  private quality = new QualityManager();
  private events = new AbortController();
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  private userReducedMotion = false;
  private particlesEnabled = true;
  private frame = 0; private refreshFrame = 0; private lastFrame = 0; private disposed = false; private lost = false;
  private positionDirty = false;
  private uiElements: { el: HTMLElement; rect: DOMRect; slots: number[] }[] = [];
  private messageLayoutKey = '';
  private root: HTMLElement | null = null; private departing = false; private uiSignature = '';
  private message: Message | null = null; private shape: string | null = null;
  private hold: { progress: number; pressed: boolean } | null = null;
  private giftAt: number | null = null; private portalAt: number | null = null; private floating = false;
  private releaseAt: number | null = null;
  private tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };
  private style = { ...DEFAULT_PARTICLE_STYLE };
  private waiters = new Set<Waiter>();
  private secret: { value: Secret; original: Map<number, Target>; slots: number[] } | null = null;
  private clip: Box | null = null;
  private baseBudget: number; private atmosphere = false;
  private lastDiagnostics = 0; private recoveryTimer = 0;
  constructor(private canvas: HTMLCanvasElement, private onError?: () => void, forceCanvas = false) {
    this.width = window.innerWidth; this.height = window.visualViewport?.height ?? window.innerHeight;
    this.reducedMotion = this.motion.matches;
    this.renderer = new ParticleRenderer(canvas, forceCanvas);
    this.baseBudget = this.renderer.kind === 'canvas2d' ? 7000 : this.width < 700 ? 11000 : 18000;
    this.pool = new ParticlePool(this.baseBudget, this.width, this.height);
    this.interaction = new InteractionSystem(() => this.time);
    const signal = this.events.signal;
    window.addEventListener('resize', this.resize, { signal });
    window.visualViewport?.addEventListener('resize', this.resize, { signal });
    window.addEventListener('scroll', this.scroll, { signal, passive: true, capture: true });
    document.addEventListener('visibilitychange', this.visibility, { signal });
    this.motion.addEventListener('change', this.changeMotion, { signal });
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; cancelAnimationFrame(this.frame); this.setHeld(false); canvas.dataset.renderer = 'recovering'; this.recoveryTimer = window.setTimeout(() => this.fail(), 3000); }, { signal });
    canvas.addEventListener('webglcontextrestored', () => {
      try { clearTimeout(this.recoveryTimer); this.renderer.initialize(); this.lost = false; this.resize(); this.lastFrame = 0; this.frame = requestAnimationFrame(this.tick); canvas.dataset.renderer = this.renderer.kind; }
      catch { this.fail(); }
    }, { signal });
    this.resize(); canvas.dataset.renderer = this.renderer.kind;
    document.fonts?.ready.then(() => { if (!this.disposed) { this.uiSignature = ''; this.refresh(); } });
    this.frame = requestAnimationFrame(this.tick);
  }
  configure(settings: MessageSettings) {
    const next = { ...DEFAULT_PARTICLE_STYLE, ...settings.particles };
    const changed = JSON.stringify(next) !== JSON.stringify(this.style);
    this.style = next;
    if (changed) { this.uiSignature = ''; this.refresh(); }
  }
  setMotionPreference(reduced: boolean) {
    this.userReducedMotion = reduced;
    this.reducedMotion = reduced || this.motion.matches;
    if (this.reducedMotion) this.setTilt(0, 0);
    this.refresh();
  }
  setParticlesEnabled(enabled: boolean) {
    if (this.particlesEnabled === enabled) return;
    this.particlesEnabled = enabled;
    if (enabled) { this.lastFrame = 0; this.refresh(); }
  }
  private get budget() { const density = this.style.density === 'light' ? .65 : this.style.density === 'rich' ? 1.15 : 1; return Math.floor((this.width < 700 ? 4500 : 7000) * this.quality.level * density); }
  private resize = () => {
    this.width = window.innerWidth; this.height = window.visualViewport?.height ?? window.innerHeight;
    this.renderer.resize(this.width, this.height, Math.min(window.devicePixelRatio || 1, this.renderer.kind === 'canvas2d' ? 1.5 : 2) * Math.max(.75, this.quality.level));
    this.uiSignature = ''; this.refresh();
  };
  private changeMotion = () => { this.reducedMotion = this.userReducedMotion || this.motion.matches; if (this.reducedMotion) this.setTilt(0,0); this.refresh(); };
  private visibility = () => {
    cancelAnimationFrame(this.frame); this.setHeld(false); this.lastFrame = 0;
    if (!document.hidden && !this.disposed && !this.lost) this.frame = requestAnimationFrame(this.tick);
  };
  private scroll = () => { this.positionDirty = true; };
  /** All DOM reads are batched once per animation frame, never rastered on scroll. */
  private syncPositions() {
    this.positionDirty = false;
    if (!this.departing) for (const entry of this.uiElements) {
      if (!entry.el.isConnected) continue;
      const next = entry.el.getBoundingClientRect();
      this.pool.translate(entry.slots, next.x - entry.rect.x, next.y - entry.rect.y);
      entry.rect = next;
    }
    const next = this.message?.options.bounds?.();
    if (next && this.clip) {
      const dx = next.x - this.clip.x, dy = next.y - this.clip.y;
      this.pool.translate(this.pool.groups.get(SCENE) ?? [], dx, dy);
      for (const glyph of this.message!.sample.glyphs) { glyph.x += dx; glyph.y += dy; }
      this.clip = next;
    }
  }
  refresh = () => {
    cancelAnimationFrame(this.refreshFrame);
    this.refreshFrame = requestAnimationFrame(() => {
      if (this.disposed) return;
      if (this.root && !this.departing) this.captureUI();
      if (this.message) { const secret = this.secret?.value, revision = this.canvas.dataset.textRevision; this.layoutMessage(this.message, true); if (secret && revision !== this.canvas.dataset.textRevision) this.revealSecret(secret); }
      else if (this.shape) this.pool.form(SCENE, sampleShape(this.shape, this.width, this.height), this.time, this.reducedMotion ? 0 : 400, 'morph');
    });
  };
  formUI(root: HTMLElement) { this.root = root; this.departing = false; this.captureUI(); }
  private captureUI() {
    if (!this.root) return;
    this.atmosphere = !!this.root.querySelector('.landing');
    const entries = [...this.root.querySelectorAll<HTMLElement>('[data-particle="hero"], [data-particle="button"], [data-particle="frame"], [data-particle="line"], [data-particle="control"]')]
      .filter(el => !el.closest('[aria-hidden="true"], [data-particle-overlay], .emoji-picker, .select-options') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
      .filter(el => {
        const closed = el.closest('details:not([open])');
        return !closed || !!closed.querySelector(':scope > summary')?.contains(el);
      })
      .map(el => ({ el, rect: el.getBoundingClientRect(), style: getComputedStyle(el) }))
      .filter(({rect}) => rect.width > 0 && rect.height > 0);
    const signature = entries.map(({el,rect}) => `${el.dataset.particle}:${el.textContent}:${el.matches(':disabled')}:${Math.round(rect.width)}:${Math.round(rect.height)}`).join('|');
    if (signature === this.uiSignature) { this.syncPositions(); return; }
    this.uiSignature = signature;
    const targets: Target[] = [];
    for (const [index, {el,rect,style}] of entries.entries()) {
      const uiElement = index + 1;
      const kind = el.dataset.particle, hero = kind === 'hero';
      const primary = el.classList.contains('primary') && !!el.closest('.landing');
      const sceneButton = !!el.closest('.puzzle-answers');
      const delay = this.reducedMotion ? 0 : Math.min(600, Number(el.dataset.particleDelay ?? 0));
      if (hero || primary || sceneButton) {
        const box = hero ? rect : { x: rect.x + 16, y: rect.y + 8, width: rect.width - 32, height: rect.height - 16 };
        const text = el.dataset.text ?? el.innerText;
        const sample = this.sampler.sample(text, box, parseFloat(style.fontSize), 'classic', style.textAlign, hero ? this.budget : 2000, style.fontFamily, '600');
        targets.push(...sample.targets.map(t => ({ ...t, alpha: el.matches(':disabled') ? .22 : .96, color: el.classList.contains('hero-second') ? COLORS.gold : COLORS.ivory, delay, uiElement })));
      }
      if (kind === 'button' || kind === 'frame' || kind === 'control' || kind === 'line') {
        const path = kind === 'line' ? [{ x: rect.x, y: rect.y }, { x: rect.right, y: rect.y }] : contour(rect.x,rect.y,rect.width,rect.height,parseFloat(style.borderRadius) || 3);
        const m = measure(path), count = Math.ceil(m.length / 4.5);
        for (let n = 0; n <= count; n++) targets.push({ ...pointAt(path,m.lengths,n/Math.max(1,count)*m.length), radius: .65, alpha: el.matches(':disabled') ? .1 : primary ? .7 : .27, color: primary ? COLORS.gold : COLORS.ivory, delay, uiElement });
      }
    }
    const uiBudget = Math.min(this.budget + 1500, Math.floor(this.pool.count * .57));
    const sampled = targets.length > uiBudget ? Array.from({ length:uiBudget },(_,i)=>targets[Math.floor(i*targets.length/uiBudget)]) : targets;
    this.pool.form(UI, sampled, this.time, this.reducedMotion ? 0 : MOTION_TIMING.interface / this.style.speed, 'morph');
    const byElement = entries.map(({el,rect}) => ({el,rect,slots:[] as number[]}));
    for (const i of this.pool.groups.get(UI) ?? []) byElement[this.pool.uiElement[i] - 1]?.slots.push(i);
    this.uiElements = byElement;
    this.canvas.dataset.uiRevision = String(Number(this.canvas.dataset.uiRevision ?? 0) + 1);
    this.canvas.dataset.uiTargetCount = String(targets.length);
  }
  departUI(root: HTMLElement) { this.root = root; this.departing = true; this.uiSignature = ''; this.pool.release(UI,this.time,.9); this.disperseText(.6); }
  formText(text: string, options: FormOptions | boolean = {}) {
    this.messageLayoutKey = '';
    this.pool.release(SECRET,this.time,.2);
    this.shape = null; this.secret = null; this.giftAt = this.portalAt = this.releaseAt = null; this.floating = false;
    const opts = typeof options === 'boolean' ? {} : { ...options };
    if (opts.effect === 'random') { const choices = EFFECTS.filter(e => e !== 'random'); opts.effect = choices[Math.floor(Math.random()*choices.length)]; }
    const timeline = opts.writing?.enabled ? typingTimeline(text, opts.writing) : graphemes(text).map(() => 0);
    const duration = this.reducedMotion ? 0 : MOTION_TIMING.text / this.style.speed;
    this.hold = opts.hold ? { progress: 0, pressed: false } : null;
    this.message = { text, options: opts, start: this.time, timeline, duration, completion: 0, sample: { targets: [], glyphs: [], fontSize: 0, lineCount: 0 } };
    this.layoutMessage(this.message);
    return this.message.completion;
  }
  private layoutMessage(message: Message, refresh = false) {
    const rect = message.options.bounds?.();
    const box = rect ? { x: rect.x + 16, y: rect.y + 16, width: Math.max(20,rect.width - 32), height: Math.max(20,rect.height - 32) } : { x: this.width * .09, y: this.height * .17, width: this.width * .82, height: this.height * (message.options.reserveSpace ? .42 : .59) };
    const font = message.options.font ?? DEFAULT_FONT;
    const layoutKey = [message.text,font,this.budget,box.width,box.height,message.options.reserveSpace].join('|');
    if (refresh && layoutKey === this.messageLayoutKey) { this.syncPositions(); return; }
    this.messageLayoutKey = layoutKey; this.clip = rect ?? null;
    this.canvas.dataset.textRevision = String(Number(this.canvas.dataset.textRevision ?? 0) + 1);
    const sample = this.sampler.sample(message.text,box,Math.min(rect ? 54 : 106,box.width / (rect ? 6 : 7)),font,'center',this.budget);
    const effect = message.options.effect ?? 'morph';
    const targets = sample.targets.map(t => {
      let delay = message.options.writing?.enabled ? message.timeline[t.glyph ?? 0] ?? 0 : 0;
      if (!message.options.writing?.enabled) {
        if (['sweep','pixel','wave'].includes(effect)) delay = (t.x-box.x)/box.width*600 / this.style.speed;
        else if (effect === 'typewriter') delay = (t.glyph ?? 0) / Math.max(1,message.timeline.length) * 600 / this.style.speed;
        else delay = ((t.x - box.x) / box.width * .65 + (t.y - box.y) / box.height * .35) * 180 / this.style.speed;
      }
      return { ...t, delay: this.reducedMotion || this.hold ? 0 : delay };
    });
    message.sample = sample;
    message.completion = this.reducedMotion ? 0 : Math.max(0,...targets.map(t=>t.delay)) + message.duration + 220;
    this.pool.form(SCENE,targets,refresh ? message.start : this.time,message.duration,effect);
    this.canvas.dataset.textFont = font; this.canvas.dataset.textEffect = effect;
    this.canvas.dataset.textFontSize = String(sample.fontSize); this.canvas.dataset.textLineCount = String(sample.lineCount);
    this.canvas.dataset.textTargetCount = String(targets.length);
    if(targets.length) this.canvas.dataset.textBounds=JSON.stringify({left:Math.min(...targets.map(t=>t.x)),right:Math.max(...targets.map(t=>t.x)),top:Math.min(...targets.map(t=>t.y)),bottom:Math.max(...targets.map(t=>t.y))});
  }
  formShape(shape: Finale['shape'] | 'gift') {
    this.pool.release(SECRET,this.time,.2);
    this.message = null; this.secret = null; this.hold = null; this.shape = shape; this.clip = null;
    this.giftAt = this.portalAt = this.releaseAt = null; this.floating = false;
    const duration = this.reducedMotion ? 0 : MOTION_TIMING.shape / this.style.speed;
    const targets = sampleShape(shape,this.width,this.height);
    this.pool.form(SCENE,targets,this.time,duration,'spiral'); this.canvas.dataset.textTargetCount = String(targets.length);
    return duration + (this.reducedMotion ? 0 : 220);
  }
  formImage(source: CanvasImageSource, box: Box) { this.disperseText(.1); this.clip = box; this.pool.form(SCENE,this.sampler.image(source,box,this.budget),this.time,this.reducedMotion ? 0 : MOTION_TIMING.image / this.style.speed,'morph'); }
  disperseText(strength = .8) { this.pool.release(SECRET,this.time,strength); this.pool.release(SCENE,this.time,strength); this.message = null; this.shape = null; this.secret = null; this.hold = null; this.giftAt = this.portalAt = null; this.releaseAt = this.time; this.clip = null; }
  loosenText() { this.disperseText(.2); }
  disperseParticles(strength = 1) { this.disperseText(strength); this.pool.release(UI,this.time,strength); this.root = null; this.departing = true; this.uiSignature = ''; }
  get holdProgress() { return this.hold?.progress ?? 1; }
  setHeld(pressed: boolean) { if (this.hold) { this.hold.pressed = pressed; if (pressed && this.reducedMotion) this.hold.progress = 1; } }
  setTilt(x: number,y: number) { this.tilt.targetX = Math.max(-1,Math.min(1,x)); this.tilt.targetY = Math.max(-1,Math.min(1,y)); }
  openGift(style: GiftStyle) { this.giftAt = this.time; this.shockwave(style === 'burst' ? 1.8 : 1); if (style === 'orbit') this.portalAt = this.time; }
  floatFinale() { this.floating = true; }
  portal() { this.portalAt = this.time; }
  shockwave(strength = 1) { if (!this.reducedMotion) this.interaction.ripple(this.width/2,this.height*.43,strength); }
  getSecretBounds(secrets: Secret[]) {
    const glyphs = this.message?.sample.glyphs ?? [];
    return secrets.flatMap((secret,n) => {
      const rows = new Map<number, typeof glyphs>();
      for (const g of glyphs) if (g.start >= secret.start && g.end <= secret.end) { const row = rows.get(g.y) ?? []; row.push(g); rows.set(g.y,row); }
      return [...rows.values()].map(row => ({ secret: n, x: row[0].x-5, y: row[0].y, width: row.at(-1)!.x + row.at(-1)!.width - row[0].x + 10, height: Math.max(44,row[0].height) }));
    });
  }
  revealSecret(value: Secret) {
    if (!this.message) return;
    const selected = new Set(this.message.sample.glyphs.filter(g => g.start >= value.start && g.end <= value.end).map(g => g.index));
    const slots = (this.pool.groups.get(SCENE) ?? []).filter(i => selected.has(this.pool.glyph[i]));
    const original = new Map<number,Target>(), p = this.pool;
    for (const i of p.groups.get(SCENE) ?? []) original.set(i,{ x:p.tx[i],y:p.ty[i],z:p.tz[i],radius:p.radius[i],alpha:p.opacity[i],glyph:p.glyph[i] });
    const box = { x:this.width*.1,y:this.height*.56,width:this.width*.8,height:this.height*.23 };
    const sample = this.sampler.sample(value.text,box,Math.min(55,this.width/12),this.message.options.font,'center',Math.max(slots.length,Math.min(this.budget,this.width<700?2200:3200)));
    // A short marked word may have too few dots for a long secret. Existing free
    // matter supports its original IDs, then returns to the ambient field.
    const selectedTargets = new Set(slots.map((_,n)=>Math.floor(n*sample.targets.length/Math.max(1,slots.length))));
    const support = sample.targets.filter((_,n)=>!selectedTargets.has(n));
    this.pool.form(SECRET,support,this.time,this.reducedMotion?0:700,'morph');
    this.canvas.dataset.secretTargetCount=String(sample.targets.length);
    slots.forEach((i,n) => {
      const t = sample.targets[Math.floor(n*sample.targets.length/Math.max(1,slots.length))]; if (!t) return;
      p.fx[i]=p.guideX[i]=p.x[i];p.fy[i]=p.guideY[i]=p.y[i];p.driftVX[i]=p.vx[i];p.driftVY[i]=p.vy[i];p.tx[i]=t.x;p.ty[i]=t.y;p.tz[i]=45;p.radius[i]=t.radius ?? 1;p.start[i]=this.time;p.duration[i]=700;p.delay[i]=0;
    });
    const active = new Set(slots);
    for (const i of p.groups.get(SCENE) ?? []) if (!active.has(i)) p.opacity[i]=.38;
    this.secret = { value, original, slots };
  }
  restoreSecret() {
    if (!this.secret) return;
    const p=this.pool; p.release(SECRET,this.time,.2);
    for (const [i,t] of this.secret.original) { p.fx[i]=p.guideX[i]=p.x[i];p.fy[i]=p.guideY[i]=p.y[i];p.driftVX[i]=p.vx[i];p.driftVY[i]=p.vy[i];p.tx[i]=t.x;p.ty[i]=t.y;p.tz[i]=t.z ?? 0;p.radius[i]=t.radius ?? 1;p.opacity[i]=t.alpha ?? .94;p.start[i]=this.time;p.duration[i]=700;p.delay[i]=0; }
    this.secret=null;
  }
  triggerHoverSparks(rect: Box) { if (!this.reducedMotion) this.interaction.hover(rect); }
  emitTypingFlow(rect?: DOMRect, _target?: DOMRect | null) { void _target; if (rect) this.triggerHoverSparks(rect); }
  private tick = (now: number) => {
    if (this.disposed || document.hidden || this.lost) return;
    // Follow the display cadence. A 15 ms cutoff starves 90/144 Hz screens of frames.
    const raw = this.lastFrame ? now-this.lastFrame : 16.67, elapsed=Math.min(50,raw);this.lastFrame=now;this.time+=elapsed;
    try {
      if (this.particlesEnabled && this.positionDirty) this.syncPositions();
      if (this.hold) {
        const before=this.hold.progress;this.hold.progress=advanceHold(before,this.hold.pressed,elapsed,this.reducedMotion);
        if (before<1 && this.hold.progress>=1) this.shockwave(.45);
      }
      const tiltResponse = response(elapsed, 3.7);
      this.tilt.x+=(this.tilt.targetX-this.tilt.x)*tiltResponse;this.tilt.y+=(this.tilt.targetY-this.tilt.y)*tiltResponse;
      if (this.particlesEnabled) {
        this.interaction.update(this.time, elapsed);
        const options: PhysicsOptions={ reduced:this.reducedMotion,hold:this.hold?.progress ?? null,tiltX:this.tilt.x,tiltY:this.tilt.y,floating:this.floating,giftAt:this.giftAt,portalAt:this.portalAt,atmosphere:this.atmosphere,quality:this.quality.level,style:this.style };
        stepPhysics(this.pool,this.interaction,this.time,elapsed,this.width,this.height,options);
        this.renderer.draw(this.pool,this.style.trails? .45:0,this.tilt.x,this.tilt.y,this.reducedMotion,this.clip);
      }
      if (this.time-this.lastDiagnostics>80) {
        this.lastDiagnostics=this.time;
        this.canvas.dataset.holdProgress=this.holdProgress.toFixed(3);
        this.canvas.style.setProperty('--hold-progress',String(this.holdProgress));
        this.root?.style.setProperty('--reveal-glow',String(this.hold ? this.hold.progress : 0));
        this.canvas.dataset.particleCount=String(this.renderer.renderedCount);this.canvas.dataset.poolCapacity=String(this.pool.count);this.canvas.dataset.linePointCount=String(this.pool.countOwned());
        if(this.message){const m=this.message;this.canvas.dataset.visibleCharacters=String(this.reducedMotion?m.timeline.length:m.timeline.filter(t=>t<=this.time-m.start).length);this.canvas.dataset.phase=this.hold?this.hold.progress>=1?'holding':'revealing':this.time-m.start>=m.completion?'holding':'forming';}
        else this.canvas.dataset.phase=this.releaseAt!==null&&this.time-this.releaseAt<1200?'dispersing':'holding';
        this.canvas.dataset.fps=String(this.quality.fps);this.canvas.dataset.quality=this.quality.level.toFixed(2);
      }
      for(const waiter of this.waiters) if(this.time>=waiter.end) waiter.finish();
      if(this.quality.sample(raw) && !this.hold && !this.secret) { this.uiSignature='';this.resize(); }
    } catch { this.fail(); return; }
    this.frame=requestAnimationFrame(this.tick);
  };
  wait(ms: number,signal?:AbortSignal):Promise<void>{
    return new Promise((resolve,reject)=>{
      if(this.disposed||signal?.aborted){reject(new DOMException('Aborted','AbortError'));return;}
      const cleanup=()=>{this.waiters.delete(waiter);signal?.removeEventListener('abort',waiter.abort);};
      const waiter:Waiter={end:this.time+ms,finish:()=>{cleanup();resolve();},abort:()=>{cleanup();reject(new DOMException('Aborted','AbortError'));}};
      this.waiters.add(waiter);signal?.addEventListener('abort',waiter.abort,{once:true});
    });
  }
  private fail(){this.onError?.();this.destroy();}
  destroy(){if(this.disposed)return;this.disposed=true;clearTimeout(this.recoveryTimer);cancelAnimationFrame(this.frame);cancelAnimationFrame(this.refreshFrame);this.events.abort();this.interaction.destroy();this.renderer.destroy();for(const w of this.waiters)w.abort();this.root=null;this.message=null;this.uiElements=[];}
}
