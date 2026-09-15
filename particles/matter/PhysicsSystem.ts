import { Behavior } from './types';
import { ParticlePool, effectId } from './MorphSystem';
import type { InteractionSystem } from './InteractionSystem';
import type { ParticleStyle } from '../../types/message';
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const fx = { explosion: effectId('explosion'), spiral: effectId('spiral'), vortex: effectId('vortex'), wave: effectId('wave'), rain: effectId('rain'), implode: effectId('implode'), magnet: effectId('magnet'), rise: effectId('rise'), bloom: effectId('bloom'), zoom: effectId('zoom'), scatter: effectId('scatter'), collect: effectId('collect'), portal: effectId('portal'), gravity: effectId('gravity'), shockwave: effectId('shockwave'), orbit: effectId('orbit'), chaos: effectId('chaos'), dust: effectId('dust'), pixel: effectId('pixel') };
export interface PhysicsOptions { reduced: boolean; hold: number | null; tiltX: number; tiltY: number; floating: boolean; giftAt: number | null; portalAt: number | null; atmosphere: boolean; quality?: number; style: ParticleStyle }
/** Seconds-based semi-implicit spring integration, substepped at <= 1/120 s.
 * Forces compose; the physical displacement is bounded around readable targets. */
export function stepPhysics(p: ParticlePool, interaction: InteractionSystem, now: number, elapsed: number, width: number, height: number, o: PhysicsOptions) {
  const steps = Math.max(1, Math.ceil(elapsed / 8.333)), dt = Math.min(elapsed, 50) / 1000 / steps;
  const clock = now * .001, scale = Math.min(width, height), cx = width / 2, cy = height * .44;
  const stiffness = o.style.preset === 'magnetic' ? 145 : o.style.preset === 'soft' ? 72 : 110;
  for (let i = 0; i < p.count; i++) {
    const owned = p.owner[i] !== 0;
    if (!owned && i % Math.max(2,Math.round(3 / (o.quality ?? 1))) !== 0 && now - p.start[i] > 1200) { p.alpha[i] = 0; continue; }
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
      p.state[i] = now - p.start[i] < 1000 ? p.state[i] : Behavior.FREE;
      p.z[i] = (random - .5) * 130;
    } else {
      const e = progress * progress * (3 - 2 * progress), arc = Math.sin(Math.PI * progress) * (1 - progress), effect = p.effect[i];
      hx = p.fx[i] + (hx - p.fx[i]) * e; hy = p.fy[i] + (hy - p.fy[i]) * e;
      if (!o.reduced) {
        if (effect === fx.explosion || effect === fx.scatter || effect === fx.chaos) { const force = effect === fx.chaos ? 1.2 : .5; hx += Math.cos(angle + (effect === fx.chaos ? progress * 12 : 0)) * scale * arc * force; hy += Math.sin(angle + (effect === fx.chaos ? progress * 9 : 0)) * scale * arc * force; }
        else if (effect === fx.spiral || effect === fx.orbit || effect === fx.portal || effect === fx.vortex) { const a = angle + progress * (effect === fx.orbit ? 6 : 12); hx += Math.cos(a) * scale * arc * .6; hy += Math.sin(a) * scale * arc * .45; }
        else if (effect === fx.wave || effect === fx.shockwave) hy += Math.sin(p.tx[i] / width * 10 - progress * 7) * arc * scale * .3;
        else if (effect === fx.rain) hy -= height * arc * .8;
        else if (effect === fx.gravity) hy += height * arc * .5 * Math.abs(Math.sin(progress * 7));
        else if (effect === fx.rise) hy += height * arc * .5;
        else if (effect === fx.implode || effect === fx.zoom) { hx += (p.tx[i] - cx) * arc * 3; hy += (p.ty[i] - cy) * arc * 3; }
        else if (effect === fx.magnet) { hx += (p.tx[i] - p.fx[i]) * Math.sin(progress * 10) * arc * .4; hy += (p.ty[i] - p.fy[i]) * Math.sin(progress * 10) * arc * .4; }
        else if (effect === fx.bloom) { hx -= (p.tx[i] - cx) * arc; hy -= (p.ty[i] - cy) * arc; }
        else if (effect === fx.dust || effect === fx.collect) { hx += Math.sin(angle + clock) * arc * 120; hy -= arc * 100; }
        else if (effect === fx.pixel) { hx += (Math.round(p.tx[i] / 28) * 28 - p.tx[i]) * (1 - progress); hy -= arc * 45; }
      }
      alpha *= o.hold !== null && scene ? .09 + progress * .91 : .4 + progress * .6;
      if (now < p.start[i] + p.delay[i]) alpha = .045;
      p.z[i] += (p.tz[i] - p.z[i]) * Math.min(1, elapsed * .006);
      p.state[i] = progress >= 1 ? o.floating ? Behavior.FLOAT : Behavior.LOCKED : effect === fx.magnet ? Behavior.MAGNETIC : Behavior.FORMING;
      if (scene && o.giftAt !== null && !o.reduced) {
        const opening = clamp((now - o.giftAt) / 850);
        if (p.part[i] === 1) { hy -= Math.sin(opening * Math.PI / 2) * scale * .16; hx += Math.sin(opening * Math.PI) * 22; }
        alpha = Math.min(1, alpha + Math.sin(opening * Math.PI) * .35);
      }
    }
    if (o.portalAt !== null && scene && !o.reduced) {
      const t = clamp((now - o.portalAt) / 1250), a = angle + t * 14, r = (1 - t) * scale * (.3 + random * .3);
      hx = cx + Math.cos(a) * r; hy = cy + Math.sin(a) * r; alpha = .7 + t * .3; p.state[i] = Behavior.PORTAL;
    }
    const drift = !owned ? 1.4 : scene && o.floating ? 1.7 : o.style.preset === 'soft' ? .3 : 0;
    if (!o.reduced) { hx += Math.sin(clock + angle) * drift; hy += Math.cos(clock * .8 + angle) * drift; }
    p.alpha[i] += (alpha - p.alpha[i]) * Math.min(1, elapsed * .005);
    if (o.reduced) { p.x[i] = hx; p.y[i] = hy; p.vx[i] = p.vy[i] = 0; continue; }
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
      const damping = Math.exp(-(owned ? 20 : 3.5) * dt);
      p.vx[i] = (p.vx[i] + ax * dt) * damping; p.vy[i] = (p.vy[i] + ay * dt) * damping;
      p.x[i] += p.vx[i] * dt; p.y[i] += p.vy[i] * dt;
    }
  }
}
