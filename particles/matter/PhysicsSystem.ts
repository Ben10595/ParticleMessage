import { Behavior } from './types';
import { ParticlePool, effectId } from './MorphSystem';
import type { InteractionSystem } from './InteractionSystem';
import type { ParticleStyle } from '../../types/message';
import { MOTION_TIMING, easeInOut, response, revealArc } from './motion';
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const TAU = Math.PI * 2;
const fx = { morph: effectId('morph'), explosion: effectId('explosion'), spiral: effectId('spiral'), vortex: effectId('vortex'), wave: effectId('wave'), rain: effectId('rain'), implode: effectId('implode'), magnet: effectId('magnet'), rise: effectId('rise'), bloom: effectId('bloom'), zoom: effectId('zoom'), scatter: effectId('scatter'), collect: effectId('collect'), portal: effectId('portal'), gravity: effectId('gravity'), shockwave: effectId('shockwave'), orbit: effectId('orbit'), chaos: effectId('chaos'), dust: effectId('dust'), pixel: effectId('pixel') };
export interface PhysicsOptions { reduced: boolean; hold: number | null; tiltX: number; tiltY: number; floating: boolean; giftAt: number | null; portalAt: number | null; atmosphere: boolean; quality?: number; style: ParticleStyle }
/** Seconds-based semi-implicit spring integration, substepped at <= 1/120 s.
 * Forces compose; the physical displacement is bounded around readable targets. */
export function stepPhysics(p: ParticlePool, interaction: InteractionSystem, now: number, elapsed: number, width: number, height: number, o: PhysicsOptions) {
  const frameTime = Math.max(0, Math.min(elapsed, 50));
  const steps = Math.max(1, Math.ceil(frameTime / (1000 / 120) - 1e-6)), dt = frameTime / 1000 / steps;
  const alphaResponse = response(frameTime, 5), depthResponse = response(frameTime, 6);
  const ownedDamping = Math.exp(-20 * dt), freeDamping = Math.exp(-3.5 * dt);
  const clock = now * .001, scale = Math.min(width, height), cx = width / 2, cy = height * .44;
  const stiffness = o.style.preset === 'magnetic' ? 145 : o.style.preset === 'soft' ? 72 : 110;
  for (let i = 0; i < p.count; i++) {
    const owned = p.owner[i] !== 0;
    if (!owned && i % Math.max(2,Math.round(3 / (o.quality ?? 1))) !== 0 && now - p.start[i] > MOTION_TIMING.retire) { p.alpha[i] = 0; continue; }
    const scene = p.owner[i] === 2, angle = p.phase[i], random = p.random[i];
    let progress = p.duration[i] === 0 ? 1 : clamp((now - p.start[i] - p.delay[i]) / p.duration[i]);
    if (scene && o.hold !== null) progress = o.hold;
    if (o.reduced && o.hold === null) progress = 1;
    let hx = p.tx[i], hy = p.ty[i], alpha = p.opacity[i];
    if (!owned) {
      const ambient = i % 12 === 0 && o.atmosphere;
      // A slow tilted orbital field surrounds the hero; unassigned matter remains available.
      const a = angle + clock * .018 * (random + .3), r = scale * (.43 + random * .16);
      hx = cx + Math.cos(a) * r * 1.24; hy = cy + Math.sin(a) * r * .62 + Math.cos(a) * r * .22;
      if (!ambient) { hx = random * width; hy = ((angle / (Math.PI * 2)) * height + clock * (2 + random * 5)) % height; }
      alpha = o.reduced ? 0 : ambient ? .07 + random * .10 : .012;
      if (!o.reduced && (p.state[i] === Behavior.DISPERSE || p.state[i] === Behavior.EXPLODE)) {
        const age = now-p.start[i], dissolve = easeInOut(age/MOTION_TIMING.dissolve);
        const returnToField = easeInOut(age/MOTION_TIMING.returnToField);
        hx = p.fx[i]+(hx-p.fx[i])*returnToField;
        hy = p.fy[i]+(hy-p.fy[i])*returnToField;
        alpha = p.opacity[i]+(alpha-p.opacity[i])*dissolve;
      }
      p.state[i] = now - p.start[i] < MOTION_TIMING.returnToField ? p.state[i] : Behavior.FREE;
      p.z[i] = (random - .5) * 130;
    } else {
      const e = easeInOut(progress), arc = revealArc(progress), effect = p.effect[i];
      hx = p.fx[i] + (hx - p.fx[i]) * e; hy = p.fy[i] + (hy - p.fy[i]) * e;
      if (!o.reduced) {
        if (effect === fx.explosion || effect === fx.scatter || effect === fx.chaos) { const force = effect === fx.chaos ? 1.2 : .5; hx += Math.cos(angle + (effect === fx.chaos ? progress * 12 : 0)) * scale * arc * force; hy += Math.sin(angle + (effect === fx.chaos ? progress * 9 : 0)) * scale * arc * force; }
        else if (effect === fx.spiral || effect === fx.orbit || effect === fx.portal || effect === fx.vortex) {
          const a = e * (effect === fx.orbit ? Math.PI : Math.PI*2), cos = Math.cos(a), sin = Math.sin(a);
          hx += (p.flowX[i]*cos-p.flowY[i]*sin)*arc*1.6;
          hy += (p.flowX[i]*sin+p.flowY[i]*cos)*arc*1.15;
        }
        else if (effect === fx.wave || effect === fx.shockwave) hy += Math.sin(p.tx[i] / width * 10 - progress * 7) * arc * scale * .3;
        else if (effect === fx.rain) hy -= height * arc * .8;
        else if (effect === fx.gravity) hy += height * arc * .5 * Math.abs(Math.sin(progress * 7));
        else if (effect === fx.rise) hy += height * arc * .5;
        else if (effect === fx.implode || effect === fx.zoom) { hx += (p.tx[i] - cx) * arc * 3; hy += (p.ty[i] - cy) * arc * 3; }
        else if (effect === fx.magnet) { hx += (p.tx[i] - p.fx[i]) * Math.sin(progress * 10) * arc * .4; hy += (p.ty[i] - p.fy[i]) * Math.sin(progress * 10) * arc * .4; }
        else if (effect === fx.bloom) { hx -= (p.tx[i] - cx) * arc; hy -= (p.ty[i] - cy) * arc; }
        else if (effect === fx.dust || effect === fx.collect) {
          const ribbon = p.flowX[i]*.012 + p.flowY[i]*.018;
          hx += Math.sin(ribbon+e*2.4)*arc*85;
          hy -= (48+Math.cos(ribbon+e*1.8)*24)*arc;
        }
        else if (effect === fx.pixel) {
          // A flowing scan-grid replaces the old rigid block hop. It still resolves
          // exactly at the glyph but bends through neighbouring pixel lanes.
          const cell = 22, gridX = Math.round(p.tx[i] / cell) * cell - p.tx[i], gridY = Math.round(p.ty[i] / cell) * cell - p.ty[i];
          const scan = Math.sin(progress * TAU + angle) * arc * (8 + random * 10);
          hx += gridX * arc * 1.35 + scan;
          hy += gridY * arc * 1.2 - arc * (34 + random * 24);
        }
        else if (effect === fx.morph) {
          const dx = p.tx[i]-p.fx[i], dy = p.ty[i]-p.fy[i], distance = Math.hypot(dx,dy);
          const bend = Math.min(85,distance*.24)*arc;
          hx -= dy/Math.max(1,distance)*bend;
          hy += dx/Math.max(1,distance)*bend;
        }
      }
      if (!o.reduced && p.owner[i] === 1) for (const hover of interaction.hoverWaves ?? []) {
        const age = now - hover.start;
        if (age < 0 || age >= 720 || p.tx[i] < hover.x - 14 || p.tx[i] > hover.x + hover.width + 14 || p.ty[i] < hover.y - 14 || p.ty[i] > hover.y + hover.height + 14) continue;
        const t = age / 720, cx = hover.x + hover.width / 2, cy = hover.y + hover.height / 2;
        const dx = (p.tx[i] - cx) / Math.max(1, hover.width / 2), dy = (p.ty[i] - cy) / Math.max(1, hover.height / 2);
        const distance = Math.max(.001, Math.hypot(dx, dy)), nx = dx / distance, ny = dy / distance;
        const angleToDot = Math.atan2(dy, dx), waveHead = t * TAU - Math.PI;
        const angleDelta = Math.atan2(Math.sin(angleToDot - waveHead), Math.cos(angleToDot - waveHead));
        const envelope = Math.sin(Math.PI * t), sparkle = Math.exp(-(angleDelta * angleDelta) / .2) * envelope;
        hx += nx * sparkle * (2.2 + random * 1.4);
        hy += ny * sparkle * (2.2 + random * 1.4);
        alpha = Math.min(1, alpha + sparkle * .24);
      }
      alpha *= o.hold !== null && scene ? .09 + progress * .91 : .4 + progress * .6;
      if (now < p.start[i] + p.delay[i]) alpha = .045;
      p.z[i] += (p.tz[i] - p.z[i]) * depthResponse;
      p.state[i] = progress >= 1 ? o.floating ? Behavior.FLOAT : Behavior.LOCKED : effect === fx.magnet ? Behavior.MAGNETIC : Behavior.FORMING;
      if (scene && o.giftAt !== null && !o.reduced) {
        const opening = easeInOut((now - o.giftAt) / MOTION_TIMING.gift);
        if (p.part[i] === 1) { hy -= Math.sin(opening * Math.PI / 2) * scale * .16; hx += Math.sin(opening * Math.PI) * 22; }
        alpha = Math.min(1, alpha + Math.sin(opening * Math.PI) * .35);
      }
    }
    if (o.portalAt !== null && scene && !o.reduced) {
      // Spiral in from the existing geometry instead of snapping onto a random ring.
      const t = easeInOut((now - o.portalAt) / MOTION_TIMING.portal), a = t * Math.PI * 2;
      const dx = hx - cx, dy = hy - cy, cos = Math.cos(a), sin = Math.sin(a);
      hx = cx + (dx * cos - dy * sin) * (1 - t);
      hy = cy + (dx * sin + dy * cos) * (1 - t);
      alpha += (1 - alpha) * t; p.state[i] = Behavior.PORTAL;
    }
    const drift = !owned ? 1.4 : scene && o.floating ? 1.7 : o.style.preset === 'soft' ? .3 : 0;
    if (!o.reduced) { hx += Math.sin(clock + angle) * drift; hy += Math.cos(clock * .8 + angle) * drift; }
    p.alpha[i] += (alpha - p.alpha[i]) * alphaResponse;
    // Carry the spring's displacement along the path. Only interaction/momentum settles;
    // the actual lettering arrives on time instead of lagging behind a moving target.
    const guideDX=owned ? hx-p.guideX[i] : 0, guideDY=owned ? hy-p.guideY[i] : 0;
    const guideVX=frameTime>0 ? guideDX*1000/frameTime : 0;
    const guideVY=frameTime>0 ? guideDY*1000/frameTime : 0;
    p.guideX[i]=hx;p.guideY[i]=hy;
    if (o.reduced) { p.x[i] = hx; p.y[i] = hy; p.vx[i] = p.vy[i] = p.driftVX[i] = p.driftVY[i] = 0; continue; }
    if (owned) { p.x[i]+=guideDX;p.y[i]+=guideDY;p.vx[i]=p.driftVX[i];p.vy[i]=p.driftVY[i]; }
    for (let s = 0; s < steps; s++) {
      let ax = (hx - p.x[i]) * (owned ? stiffness : 2.4), ay = (hy - p.y[i]) * (owned ? stiffness : 2.4);
      if (o.style.wind) ax += Math.sin(clock * .4 + p.y[i] * .003) * (owned ? 5 : 22);
      if (o.style.gravity) ay += owned ? 9 : 38;
      if (o.style.interaction !== 'none' && !(scene && o.hold !== null && o.hold < 1)) {
        for (const pointer of interaction.pointers.values()) {
          const dx = p.x[i] - pointer.x, dy = p.y[i] - pointer.y, d = Math.hypot(dx, dy), radius = pointer.touch ? 76 : 100;
          if (d < radius && d > .01) {
            const pressure = (1 - d / radius) ** 2, sign = o.style.interaction === 'attract' ? -1 : 1;
            // Small interface lettering stays readable under a resting cursor.
            const response = owned && !scene ? .18 : 1;
            const force = (o.style.preset === 'explosive' ? 3600 : 1300) * response;
            ax += dx / d * pressure * force * sign + pointer.vx * pressure * .5 * response;
            ay += dy / d * pressure * force * sign + pointer.vy * pressure * .5 * response;
            p.state[i] = Behavior.INTERACTIVE;
          }
        }
      }
      if (o.style.ripples) for (const ripple of interaction.ripples) {
        const dx = p.x[i] - ripple.x, dy = p.y[i] - ripple.y, d = Math.hypot(dx, dy), age = (now - ripple.start) / 1000;
        const wave = Math.exp(-(((d - age * 520) / 38) ** 2)) * Math.max(0, 1 - age / 1.5) * ripple.strength * (owned && !scene ? 480 : 2100);
        if (d > .1) { ax += dx / d * wave; ay += dy / d * wave; }
      }
      p.ax[i] = ax; p.ay[i] = ay;
      const damping = owned ? ownedDamping : freeDamping;
      p.vx[i] = (p.vx[i] + ax * dt) * damping; p.vy[i] = (p.vy[i] + ay * dt) * damping;
      p.x[i] += p.vx[i] * dt; p.y[i] += p.vy[i] * dt;
    }
    if (owned) { p.driftVX[i]=p.vx[i];p.driftVY[i]=p.vy[i];p.vx[i]+=guideVX;p.vy[i]+=guideVY; }
  }
}
