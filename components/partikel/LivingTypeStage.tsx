'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { LivingTypeEngine, LivingTypeParams, MessageFont, TextAlign, TextSize } from '@/types/message';
import { buildLivingGeometry, type LivingGeometry, type LivingPoint } from '@/particles/matter/livingTypeGeometry';
import {
  LIVING_TRANSITION_MS, easeInOut, easeOut, hash01, livingDuration, resolveLivingParams,
  textEnergy, type LivingTextEnergy, type LivingTransition,
} from '@/particles/matter/livingType';

export type { LivingTransition } from '@/particles/matter/livingType';
export { livingDuration, LIVING_TRANSITION_MS } from '@/particles/matter/livingType';

export interface LivingTypeStageProps {
  text: string;
  engine?: LivingTypeEngine;
  engineParams?: Partial<LivingTypeParams>;
  font?: MessageFont;
  fontFamily?: string;
  size?: TextSize;
  align?: TextAlign;
  playing?: boolean;
  replayKey?: string | number;
  transition?: LivingTransition;
  reducedMotion?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaHidden?: boolean;
  onComplete?: () => void;
}

interface Scene {
  id: number;
  engine: LivingTypeEngine;
  text: string;
  energy: LivingTextEnergy;
  params: LivingTypeParams;
  geometry: LivingGeometry;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const measuredPathLengths = new WeakMap<SVGPathElement, number>();
const pointLimit = (engine: LivingTypeEngine, amount: number) => engine === 'particle'
  ? Math.round(260 * amount) : engine === 'orbit' ? 138 : engine === 'shatter' ? 112
    : engine === 'liquid' ? 82 : engine === 'thread' ? 52 : 0;

function TextRows({ geometry, fill = '#d9f7f9', stroke, strokeWidth, opacity = 1 }: {
  geometry: LivingGeometry; fill?: string; stroke?: string; strokeWidth?: number; opacity?: number;
}) {
  return <g opacity={opacity} fontFamily={geometry.fontFamily} fontSize={geometry.fontSize}
    fontWeight={geometry.fontWeight} textAnchor={geometry.rows[0]?.x < geometry.width * .25 ? 'start' : geometry.rows[0]?.x > geometry.width * .75 ? 'end' : 'middle'}>
    {geometry.rows.map((row, index) => <text key={index} x={row.x} y={row.y}
      fill={fill} stroke={stroke} strokeWidth={strokeWidth} paintOrder="stroke" xmlSpace="preserve">{row.text}</text>)}
  </g>;
}

function sampled(points: LivingPoint[], count: number): LivingPoint[] {
  if (points.length <= count) return points;
  return Array.from({ length: count }, (_, index) => points[Math.floor(index * points.length / count)]);
}

function SceneArtwork({ scene, params, prefix }: { scene: Scene; params: LivingTypeParams; prefix: string }) {
  const { geometry: g, engine } = scene;
  const points = sampled(g.points, pointLimit(engine, params.amount));
  const bounds = g.bounds;
  const midX = bounds.x + bounds.width / 2, midY = bounds.y + bounds.height / 2;
  const rows = <TextRows geometry={g} />;
  return <>
    <defs>
      <filter id={`${prefix}-glow`} x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation={2 + params.glow * 4} />
      </filter>
      <filter id={`${prefix}-liquid`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur in="SourceGraphic" stdDeviation={Math.max(2, 5 + params.intensity * 5)} result="blur" />
        <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" />
      </filter>
      <radialGradient id={`${prefix}-void`} cx="50%" cy="50%" r="58%">
        <stop offset="0%" stopColor="#2f7688" stopOpacity=".27" />
        <stop offset="55%" stopColor="#123043" stopOpacity=".10" />
        <stop offset="100%" stopColor="#02060b" stopOpacity="0" />
      </radialGradient>
      <clipPath id={`${prefix}-draw-clip`}><rect data-role="draw-clip" x={bounds.x - 12} y="0" width="0" height={g.height} /></clipPath>
      <clipPath id={`${prefix}-signal-clip`}><rect data-role="signal-clip" x={bounds.x - 12} y="0" width="0" height={g.height} /></clipPath>
      <mask id={`${prefix}-void-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width={g.width} height={g.height}>
        <rect width={g.width} height={g.height} fill="white" />
        <TextRows geometry={g} fill="black" />
      </mask>
    </defs>

    {engine === 'line' && <>
      <path data-role="line-halo" d={g.route} fill="none" stroke="#75ddf5" strokeWidth={params.lineWidth * 5}
        strokeLinecap="round" strokeLinejoin="round" filter={`url(#${prefix}-glow)`} />
      <path data-role="line-body" d={g.route} fill="none" stroke="#a8eaf6" strokeWidth={params.lineWidth}
        strokeLinecap="round" strokeLinejoin="round" />
      <path data-role="line-trail" d={g.route} fill="none" stroke="#efffff" strokeWidth={Math.max(.8, params.lineWidth * .58)}
        strokeLinecap="round" strokeLinejoin="round" />
      <circle data-role="line-head-halo" r={Math.max(5, params.lineWidth * 5)} fill="#a5eeff" filter={`url(#${prefix}-glow)`} />
      <circle data-role="line-head" r={Math.max(1.7, params.lineWidth * 1.05)} fill="#f2ffff" />
      <g data-role="line-split">
        <path data-role="split-a" d="" fill="none" stroke="#a5edfa" strokeWidth={params.lineWidth * .46} strokeLinecap="round" />
        <path data-role="split-b" d="" fill="none" stroke="#a5edfa" strokeWidth={params.lineWidth * .42} strokeLinecap="round" />
      </g>
      <g data-role="final-text" opacity="0">{rows}</g>
    </>}

    {engine === 'particle' && <>
      <g data-role="particle-field" filter={`url(#${prefix}-glow)`} opacity=".22">
        {points.map((p, i) => <circle key={i} data-role="particle-ghost" cx={p.x} cy={p.y} r={params.size * 2.3} fill="#76d9ef" />)}
      </g>
      <g>{points.map((p, i) => <circle key={i} data-role="particle" cx={p.x} cy={p.y}
        r={(i % 8 === 0 ? 1.75 : .95) * params.size} fill={i % 13 === 0 ? '#f6ffff' : '#9cdeef'} />)}</g>
      <g data-role="final-text" opacity="0"><TextRows geometry={g} opacity={.42} /></g>
    </>}

    {engine === 'liquid' && <>
      <g data-role="liquid-body" filter={`url(#${prefix}-liquid)`}>
        {points.map((p, i) => <circle key={i} data-role="liquid-drop" cx={p.x} cy={p.y}
          r={5 + hash01(i) * 6} fill={i % 7 ? '#9bdceb' : '#dcffff'} />)}
      </g>
      <g data-role="liquid-clear">
        {points.map((p, i) => <circle key={i} data-role="liquid-bead" cx={p.x} cy={p.y}
          r={1.4 + hash01(i * 13) * 2.7} fill={i % 7 ? '#97e2ef' : '#e2ffff'} opacity=".8" />)}
      </g>
      <g data-role="final-text" opacity="0"><TextRows geometry={g} fill="#d1f5f7" /></g>
      <path data-role="liquid-sheen" d={`M${bounds.x} ${midY} Q${midX} ${midY - 20} ${bounds.x + bounds.width} ${midY}`}
        fill="none" stroke="#e2ffff" strokeWidth=".7" opacity="0" />
    </>}

    {engine === 'thread' && <>
      <g>{points.map((p, i) => <path key={i} data-role="thread" d={`M${i % 2 ? 0 : g.width} ${p.y} Q${midX} ${p.y} ${p.x} ${p.y}`}
        fill="none" stroke={i % 7 === 0 ? '#d9f9ff' : '#7ec3d1'} strokeWidth={i % 7 === 0 ? .82 : .42} />)}</g>
      <g data-role="final-text" opacity="0"><TextRows geometry={g} opacity={.7} /></g>
    </>}

    {engine === 'signal' && <>
      <g clipPath={`url(#${prefix}-signal-clip)`} data-role="signal-text">{rows}</g>
      <g data-role="signal-lines">{Array.from({ length: 27 }, (_, i) => <line key={i} data-role="signal-line"
        x1={bounds.x - 10} x2={bounds.x + bounds.width + 10}
        y1={bounds.y + i * (bounds.height / 26)} y2={bounds.y + i * (bounds.height / 26)}
        stroke="#a8e8f3" strokeWidth={i % 5 === 0 ? .8 : .33} opacity="0" />)}</g>
      <rect data-role="signal-sweep" x={bounds.x - 5} y={bounds.y - 8} width="2" height={bounds.height + 16}
        fill="#c7f6ff" opacity="0" filter={`url(#${prefix}-glow)`} />
    </>}

    {engine === 'orbit' && <>
      <ellipse data-role="orbit-ring" cx={midX} cy={midY} rx={bounds.width * .55} ry={bounds.height * .79}
        fill="none" stroke="#8acbda" strokeWidth=".55" opacity="0" />
      <g>{points.map((p, i) => <circle key={i} data-role="orbit-point" cx={p.x} cy={p.y}
        r={i % 11 === 0 ? 1.55 : .82} fill={i % 7 ? '#b8edf5' : '#fff'} />)}</g>
      <g data-role="final-text" opacity="0"><TextRows geometry={g} opacity={.72} /></g>
    </>}

    {engine === 'shatter' && <>
      <g>{points.map((p, i) => {
        const radius = 1.7 + hash01(i * 3) * 3.1;
        return <polygon key={i} data-role="shard" points={`0,${-radius} ${radius * .82},${radius * .7} ${-radius * .82},${radius * .7}`}
          transform={`translate(${p.x} ${p.y})`} fill={i % 9 === 0 ? '#ebffff' : '#8ccee0'}
          opacity={i % 5 === 0 ? .94 : .7} />;
      })}</g>
      <g data-role="final-text" opacity="0"><TextRows geometry={g} opacity={.56} /></g>
    </>}

    {engine === 'echo' && <>
      {Array.from({ length: params.count }, (_, i) => <g key={i} data-role="echo" opacity="0">
        <TextRows geometry={g} fill="none" stroke={i % 2 ? '#92d6e3' : '#d7f8ff'} strokeWidth={.75 + i * .12} />
      </g>)}
      <g data-role="final-text" opacity="0">{rows}</g>
    </>}

    {engine === 'draw' && <>
      <g clipPath={`url(#${prefix}-draw-clip)`} data-role="draw-writing">
        <TextRows geometry={g} fill="none" stroke="#b9edf6" strokeWidth={1.35 + params.intensity * 1.2} />
      </g>
      <circle data-role="draw-pen-glow" r="11" fill="#9ce9f7" filter={`url(#${prefix}-glow)`} opacity=".6" />
      <circle data-role="draw-pen" r="2" fill="#f5ffff" />
      <g data-role="final-text" opacity="0"><TextRows geometry={g} fill="#d8f5f7" /></g>
    </>}

    {engine === 'void' && <>
      <rect data-role="void-field" x="0" y="0" width={g.width} height={g.height} fill={`url(#${prefix}-void)`}
        mask={`url(#${prefix}-void-mask)`} opacity="0" />
      <g data-role="void-rim" opacity="0">
        <TextRows geometry={g} fill="#02050a" stroke="#7dbac9" strokeWidth={.8} />
      </g>
      <g data-role="void-refraction" opacity="0" transform="translate(2 0)">
        <TextRows geometry={g} fill="none" stroke="#b3e9f1" strokeWidth={.45} />
      </g>
    </>}
    <circle data-role="emoji-heart" cx={midX} cy={midY} r="1" fill="none" stroke="#a1e4ee" strokeWidth=".8" opacity="0" />
    <g data-role="emoji-sparkle" opacity="0" stroke="#dcf8fa" strokeWidth=".75" strokeLinecap="round">
      <path d={`M${midX - 10} ${midY}h20 M${midX} ${midY - 10}v20`} />
      <path d={`M${midX - 5} ${midY - 5}l10 10 M${midX + 5} ${midY - 5}l-10 10`} opacity=".42" />
    </g>
  </>;
}

function nodes(root: SVGGElement, role: string): SVGElement[] {
  return [...root.querySelectorAll<SVGElement>(`[data-role="${role}"]`)];
}
function attr(node: SVGElement | undefined, name: string, value: string | number): void {
  node?.setAttribute(name, String(value));
}
function clamp(value: number): number { return Math.max(0, Math.min(1, value)); }

function paint(root: SVGGElement, scene: Scene, params: LivingTypeParams, time: number, duration: number): void {
  const g = scene.geometry, engine = scene.engine;
  const t = clamp(time / duration);
  const ease = easeOut(t);
  const energy = scene.energy;
  const finalText = nodes(root, 'final-text')[0];
  root.dataset.progress = t.toFixed(3);
  root.dataset.phase = t >= 1 ? 'holding' : 'forming';
  if (energy.emoji) root.dataset.emoji = energy.emoji;
  const emojiTime = clamp((t - .7) / .3);
  if (energy.emoji === 'heart') {
    const ring = nodes(root, 'emoji-heart')[0];
    attr(ring, 'r', 3 + emojiTime * Math.min(g.width, g.height) * .26);
    attr(ring, 'opacity', emojiTime > 0 ? Math.sin(Math.PI * emojiTime) * .33 : 0);
  } else if (energy.emoji === 'sparkle') {
    const sparkle = nodes(root, 'emoji-sparkle')[0];
    attr(sparkle, 'opacity', emojiTime > 0 ? Math.sin(Math.PI * emojiTime) * .6 : 0);
    attr(sparkle, 'transform', `rotate(${(emojiTime * 40).toFixed(1)} ${g.width / 2} ${g.height / 2})`);
  } else if (energy.emoji === 'laugh' && t < 1) {
    root.setAttribute('transform', `translate(0 ${(Math.sin(t * 31) * (1 - t) * 1.8).toFixed(2)})`);
  }

  if (engine === 'line') {
    const body = nodes(root, 'line-body')[0] as SVGPathElement | undefined;
    const halo = nodes(root, 'line-halo')[0] as SVGPathElement | undefined;
    const trail = nodes(root, 'line-trail')[0] as SVGPathElement | undefined;
    const head = nodes(root, 'line-head')[0], headHalo = nodes(root, 'line-head-halo')[0];
    if (!g.route) {
      for (const element of [body, halo, trail, head, headHalo]) attr(element, 'opacity', 0);
      attr(finalText, 'opacity', 1);
      return;
    }
    let length = body ? measuredPathLengths.get(body) ?? 0 : 0;
    if (body && !length) { length = body.getTotalLength(); measuredPathLengths.set(body, length); }
    const morphMs = 520 / params.morphSpeed / params.speed;
    const traceRatio = clamp(time / Math.max(1, duration - morphMs));
    // Variable speed, tiny hesitations and a spring tail keep the motion from looking mechanical.
    const hesitation = .012 * params.curvature * Math.sin(traceRatio * 47) ** 8;
    const draw = clamp(easeInOut(traceRatio) - hesitation + params.spring * .004 * Math.sin(traceRatio * 28) * (1 - traceRatio));
    const visible = length * draw;
    const morph = easeInOut(clamp((time - (duration - morphMs)) / morphMs));
    for (const path of [body, halo]) {
      if (!path) continue;
      attr(path, 'stroke-dasharray', `${length} ${length}`);
      attr(path, 'stroke-dashoffset', length - visible);
      attr(path, 'opacity', path === body ? (1 - morph * .92) : params.glow * .62 * (1 - morph));
    }
    if (trail) {
      const trailLength = Math.max(12, length * (.025 + params.trail * .11));
      attr(trail, 'stroke-dasharray', `${trailLength} ${length}`);
      attr(trail, 'stroke-dashoffset', trailLength - visible);
      attr(trail, 'opacity', (1 - morph) * .95);
    }
    if (body && length) {
      const headPoint = body.getPointAtLength(visible);
      const before = body.getPointAtLength(Math.max(0, visible - 4));
      const tangent = Math.atan2(headPoint.y - before.y, headPoint.x - before.x);
      const wobble = Math.sin(time * .017) * params.curvature * 2.4 * (1 - morph);
      const hx = headPoint.x + Math.cos(tangent + Math.PI / 2) * wobble;
      const hy = headPoint.y + Math.sin(tangent + Math.PI / 2) * wobble;
      for (const circle of [head, headHalo]) { attr(circle, 'cx', hx); attr(circle, 'cy', hy); attr(circle, 'opacity', 1 - morph); }
      const split = nodes(root, 'line-split')[0];
      const fork = Math.sin(traceRatio * 24) > .88 && traceRatio > .08 && traceRatio < .88;
      attr(split, 'opacity', fork ? .58 * (1 - morph) : 0);
      if (fork) {
        const radius = 5 + params.curvature * 12;
        attr(nodes(root, 'split-a')[0], 'd', `M${hx - radius} ${hy + radius * .3} Q${hx} ${hy - radius} ${hx + radius} ${hy}`);
        attr(nodes(root, 'split-b')[0], 'd', `M${hx - radius} ${hy - radius * .3} Q${hx} ${hy + radius} ${hx + radius} ${hy}`);
      }
    }
    attr(finalText, 'opacity', morph);
    return;
  }

  if (engine === 'particle' || engine === 'orbit' || engine === 'liquid' || engine === 'shatter') {
    const role = engine === 'particle' ? 'particle' : engine === 'orbit' ? 'orbit-point' : engine === 'liquid' ? 'liquid-drop' : 'shard';
    const elements = nodes(root, role);
    const targets = sampled(g.points, elements.length);
    const ghosts = engine === 'particle' ? nodes(root, 'particle-ghost') : [];
    const liquidBeads = engine === 'liquid' ? nodes(root, 'liquid-bead') : [];
    elements.forEach((el, i) => {
      const target = targets[i]; if (!target) return;
      const phase = hash01(i * 17 + 9) * Math.PI * 2;
      const distance = Math.max(g.width, g.height) * (.19 + params.scatter * .46) * (engine === 'orbit' ? .42 : 1);
      const delay = hash01(i * 11 + 5) * (engine === 'particle' ? .33 : .26);
      const local = easeOut(clamp((t - delay) / (1 - delay)));
      const damp = Math.exp(-local * (4 + params.magnetism * 5));
      let x = target.x, y = target.y;
      if (engine === 'orbit') {
        const orbit = (1 - local) * (14 + params.intensity * 44);
        const angle = phase + (1 - local) * Math.PI * 4;
        x += Math.cos(angle) * orbit;
        y += Math.sin(angle) * orbit * .65;
      } else {
        const sx = Math.cos(phase) * distance, sy = Math.sin(phase) * distance * .65;
        x += sx * (1 - local) + sx * damp * Math.sin(local * 16) * .14;
        y += sy * (1 - local) + sy * damp * Math.cos(local * 12) * .14;
      }
      if (engine === 'shatter') {
        attr(el, 'transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${((1 - local) * (hash01(i * 4) * 540 - 270)).toFixed(1)})`);
      } else { attr(el, 'cx', x.toFixed(1)); attr(el, 'cy', y.toFixed(1)); }
      attr(el, 'opacity', Math.min(1, .24 + local * .76));
      if (ghosts[i]) { attr(ghosts[i], 'cx', x.toFixed(1)); attr(ghosts[i], 'cy', y.toFixed(1)); }
      if (liquidBeads[i]) { attr(liquidBeads[i], 'cx', x.toFixed(1)); attr(liquidBeads[i], 'cy', y.toFixed(1)); }
    });
    attr(finalText, 'opacity', engine === 'liquid' ? Math.pow(clamp((t - .12) / .88), .9)
      : engine === 'shatter' ? easeInOut(clamp((t - .78) / .22)) * .52
        : easeInOut(clamp((t - .82) / .18)) * .45);
    if (engine === 'liquid') {
      attr(nodes(root, 'liquid-body')[0], 'opacity', 1 - .38 * easeInOut(clamp((t - .7) / .3)));
      attr(nodes(root, 'liquid-clear')[0], 'opacity', .8 - .4 * easeInOut(clamp((t - .72) / .28)));
      attr(nodes(root, 'liquid-sheen')[0], 'opacity', Math.sin(Math.PI * clamp((t - .45) / .43)) * .48);
    }
    if (engine === 'orbit') attr(nodes(root, 'orbit-ring')[0], 'opacity', Math.sin(Math.PI * t) * .32);
    return;
  }

  if (engine === 'thread') {
    const threads = nodes(root, 'thread');
    const targets = sampled(g.points, threads.length);
    threads.forEach((el, i) => {
      const p = targets[i]; if (!p) return;
      const startX = i % 2 ? -g.width * .08 : g.width * 1.08;
      const startY = p.y + (hash01(i * 9) - .5) * g.height * .55;
      const local = easeInOut(clamp((t - i / threads.length * .28) / .72));
      const endX = startX + (p.x - startX) * local;
      const endY = startY + (p.y - startY) * local;
      const bend = Math.sin(t * 13 + i * 1.8) * (1 - local) * (18 + params.intensity * 28);
      attr(el, 'd', `M${startX.toFixed(1)} ${startY.toFixed(1)} Q${((startX + endX) / 2).toFixed(1)} ${((startY + endY) / 2 + bend).toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`);
      attr(el, 'opacity', .23 + local * .73);
    });
    attr(finalText, 'opacity', easeInOut(clamp((t - .65) / .35)) * .72);
    return;
  }

  if (engine === 'signal') {
    const bounds = g.bounds;
    const x = bounds.x - 12 + (bounds.width + 24) * easeInOut(t);
    attr(nodes(root, 'signal-clip')[0], 'width', Math.max(0, x - (bounds.x - 12)));
    const sweep = nodes(root, 'signal-sweep')[0];
    attr(sweep, 'x', x);
    attr(sweep, 'opacity', t < .9 ? .52 + params.intensity * .38 : 0);
    nodes(root, 'signal-lines').forEach(el => attr(el, 'opacity', Math.sin(Math.PI * t) * .42));
    nodes(root, 'signal-line').forEach((el, i) => {
      const pulse = hash01(i * 7 + Math.floor(time / 95));
      attr(el, 'opacity', pulse > .65 ? .13 + params.intensity * .32 : .025);
      attr(el, 'transform', `translate(${((pulse - .5) * (1 - ease) * params.intensity * 10).toFixed(1)} 0)`);
    });
    attr(nodes(root, 'signal-text')[0], 'transform', t < .94 ? `translate(${((hash01(Math.floor(time / 90)) - .5) * (1 - t) * 5).toFixed(1)} 0)` : 'translate(0 0)');
    return;
  }

  if (engine === 'echo') {
    nodes(root, 'echo').forEach((el, i, all) => {
      const local = easeInOut(clamp((time - i * params.delay) / (duration - i * params.delay)));
      const offset = (all.length - i) * params.distance * (1 - local);
      const sign = i % 2 ? -1 : 1;
      attr(el, 'transform', `translate(${(sign * offset).toFixed(1)} ${((i - all.length / 2) * offset * .28).toFixed(1)})`);
      attr(el, 'opacity', (.13 + .33 * local) * (1 - easeInOut(clamp((t - .76) / .24))));
      (el as SVGElement).style.filter = params.blur ? `blur(${((1 - local) * params.blur).toFixed(1)}px)` : '';
    });
    attr(finalText, 'opacity', easeInOut(clamp((t - .65) / .35)));
    return;
  }

  if (engine === 'draw') {
    const bounds = g.bounds;
    const x = bounds.x - 12 + (bounds.width + 24) * easeInOut(clamp(t / .88));
    attr(nodes(root, 'draw-clip')[0], 'width', x - (bounds.x - 12));
    for (const pen of [...nodes(root, 'draw-pen'), ...nodes(root, 'draw-pen-glow')]) {
      attr(pen, 'cx', x);
      attr(pen, 'cy', bounds.y + bounds.height * (.45 + .2 * Math.sin(t * 21)));
      attr(pen, 'opacity', t < .9 ? 1 : 0);
    }
    attr(finalText, 'opacity', easeInOut(clamp((t - .72) / .28)));
    return;
  }

  if (engine === 'void') {
    attr(nodes(root, 'void-field')[0], 'opacity', easeInOut(clamp(t / .7)) * (.6 + params.intensity * .4));
    attr(nodes(root, 'void-rim')[0], 'opacity', easeInOut(clamp((t - .35) / .55)));
    const refraction = nodes(root, 'void-refraction')[0];
    attr(refraction, 'opacity', Math.sin(Math.PI * t) * (.1 + params.intensity * .22));
    attr(refraction, 'transform', `translate(${(Math.sin(time * .006) * 3 * (1 - ease)).toFixed(1)} 0)`);
  }

}

function SceneView({ scene, params, playing, reducedMotion, delayMs, transition, outgoing, onExit, onComplete, stageId }: {
  scene: Scene; params: LivingTypeParams; playing: boolean; reducedMotion: boolean; delayMs: number;
  transition: LivingTransition; outgoing?: boolean; onExit?: () => void; onComplete?: () => void; stageId: string;
}) {
  const ref = useRef<SVGGElement>(null);
  const playingRef = useRef(playing), callbackRef = useRef(onComplete), exitRef = useRef(onExit);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { callbackRef.current = onComplete; exitRef.current = onExit; }, [onComplete, onExit]);
  const duration = livingDuration(scene.text, scene.engine, params);
  const prefix = `living-${stageId}-${scene.id}`;
  const paramsKey = JSON.stringify(params);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const missingGeometry = scene.engine === 'line' ? !scene.geometry.route
      : ['particle', 'liquid', 'thread', 'orbit', 'shatter'].includes(scene.engine) && !scene.geometry.points.length;
    if (reducedMotion || missingGeometry) {
      if (outgoing) { exitRef.current?.(); return; }
      paint(root, scene, params, duration, duration);
      attr(nodes(root, 'final-text')[0], 'opacity', 1);
      root.style.opacity = '1';
      let cancelled = false;
      queueMicrotask(() => { if (!cancelled) callbackRef.current?.(); });
      return () => { cancelled = true; };
    }
    let frame = 0, previous = 0, elapsed = 0, finished = false;
    if (!outgoing) { paint(root, scene, params, 0, duration); root.style.opacity = delayMs ? '0' : '1'; }
    else { paint(root, scene, params, duration, duration); root.style.opacity = '1'; }
    const tick = (now: number) => {
      const delta = previous ? Math.min(48, now - previous) : 16.7;
      previous = now;
      if (playingRef.current && !document.hidden) elapsed += delta;
      if (outgoing) {
        const exitProgress = clamp(elapsed / LIVING_TRANSITION_MS);
        const eased = easeInOut(exitProgress);
        root.style.opacity = String(1 - eased);
        if (transition === 'line') {
          const center = scene.geometry.height / 2;
          root.setAttribute('transform', `translate(${(scene.geometry.width * .14 * eased).toFixed(1)} ${(center * eased).toFixed(1)}) scale(${(1 - .25 * eased).toFixed(3)} ${(1 - .97 * eased).toFixed(3)})`);
        } else if (transition === 'contour') {
          root.setAttribute('transform', `translate(${(scene.geometry.width * .5 * eased).toFixed(1)} ${(scene.geometry.height * .5 * eased).toFixed(1)}) scale(${(1 - eased).toFixed(3)})`);
        }
        if (exitProgress >= 1) { exitRef.current?.(); return; }
      } else if (elapsed >= delayMs) {
        root.style.opacity = '1';
        paint(root, scene, params, Math.min(duration, elapsed - delayMs), duration);
        if (elapsed - delayMs >= duration && !finished) {
          finished = true;
          callbackRef.current?.();
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  // JSON captures live slider changes; the scene is intentionally replayed with the updated settings.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, paramsKey, duration, delayMs, reducedMotion, outgoing, transition]);

  return <g ref={ref} data-living-scene={scene.engine} data-scene-id={scene.id}>
    <SceneArtwork scene={scene} params={params} prefix={prefix} />
  </g>;
}

function BridgeLine({ from, to, playing, stageId }: { from: LivingGeometry; to: LivingGeometry; playing: boolean; stageId: string }) {
  const bright = useRef<SVGPathElement>(null);
  const glow = useRef<SVGPathElement>(null);
  const playingRef = useRef(playing);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => {
    const path = bright.current;
    if (!path) return;
    const length = path.getTotalLength();
    let frame = 0, previous = 0, elapsed = 0;
    const tick = (now: number) => {
      const delta = previous ? Math.min(48, now - previous) : 16.7;
      previous = now;
      if (playingRef.current && !document.hidden) elapsed += delta;
      const t = clamp(elapsed / LIVING_TRANSITION_MS);
      const visible = Math.min(90, length * .23);
      for (const line of [path, glow.current]) {
        if (!line) continue;
        attr(line, 'stroke-dasharray', `${visible} ${length}`);
        attr(line, 'stroke-dashoffset', visible - length * easeInOut(t));
        attr(line, 'opacity', Math.sin(Math.PI * t) * (line === path ? .93 : .43));
      }
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, to]);
  const sx = from.bounds.x + from.bounds.width * .78;
  const sy = from.bounds.y + from.bounds.height * .48;
  const ex = to.bounds.x + to.bounds.width * .22;
  const ey = to.bounds.y + to.bounds.height * .52;
  const path = `M${sx.toFixed(1)} ${sy.toFixed(1)} C${(from.width * 1.04).toFixed(1)} ${(sy - from.height * .22).toFixed(1)} ${(-to.width * .04).toFixed(1)} ${(ey + to.height * .19).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  return <g data-living-bridge="line" aria-hidden="true">
    <defs><filter id={`living-bridge-${stageId}`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5" /></filter></defs>
    <path ref={glow} d={path} fill="none" stroke="#72d7eb" strokeWidth="8" strokeLinecap="round" opacity="0"
      filter={`url(#living-bridge-${stageId})`} />
    <path ref={bright} d={path} fill="none" stroke="#defdff" strokeWidth="1.2" strokeLinecap="round" opacity="0" />
  </g>;
}

/** Standalone SVG stage; the app's single global particle canvas remains untouched. */
export function LivingTypeStage({
  text, engine = 'particle', engineParams, font = 'classic', fontFamily, size = 'medium', align = 'center',
  playing = true, replayKey, transition = 'none', reducedMotion, className, style, ariaHidden = true, onComplete,
}: LivingTypeStageProps) {
  const host = useRef<HTMLDivElement>(null);
  const stageId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [motionReduced, setMotionReduced] = useState(false);
  const [scenes, setScenes] = useState<{ current: Scene | null; outgoing: Scene | null; delay: number }>({ current: null, outgoing: null, delay: 0 });
  const nextId = useRef(0);
  const lastInput = useRef('');
  const params = useMemo(() => resolveLivingParams(engineParams, engine), [engineParams, engine]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setDimensions({ width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;
    const signature = [text, engine, font, fontFamily, size, align, replayKey, dimensions.width, dimensions.height].join('|');
    if (signature === lastInput.current) return;
    const previous = lastInput.current;
    lastInput.current = signature;
    let geometry: LivingGeometry;
    try { geometry = buildLivingGeometry(text, dimensions.width, dimensions.height, font, size, align, fontFamily); }
    catch {
      // The SVG still renders readable text if a browser denies pixel reads.
      const family = fontFamily || 'sans-serif';
      geometry = { width: dimensions.width, height: dimensions.height, fontSize: Math.min(72, dimensions.height * .25),
        fontFamily: family, fontWeight: 600, rows: [{ text, x: dimensions.width / 2, y: dimensions.height / 2 }],
        route: '', points: [], outline: [], bounds: { x: dimensions.width * .1, y: dimensions.height * .35,
          width: dimensions.width * .8, height: dimensions.height * .3 } };
    }
    const scene: Scene = { id: ++nextId.current, text, engine, energy: textEnergy(text), params, geometry };
    setScenes(current => {
      const textChanged = Boolean(current.current && (current.current.text !== text || current.current.engine !== engine));
      const bridge = textChanged && previous && transition !== 'none' && !reducedMotion && !motionReduced ? LIVING_TRANSITION_MS : 0;
      return { current: scene, outgoing: bridge ? current.current : null, delay: bridge };
    });
  }, [text, engine, font, fontFamily, size, align, replayKey, dimensions, reducedMotion, motionReduced, transition, params]);

  const actualReduced = Boolean(reducedMotion || motionReduced);
  return <div ref={host} className={className} style={{ width: '100%', height: '100%', position: 'relative', pointerEvents: 'none', ...style }}
    aria-hidden={ariaHidden} role={ariaHidden ? undefined : 'img'} aria-label={ariaHidden ? undefined : text}
    data-living-engine={engine} data-living-ready={Boolean(scenes.current)}>
    <svg xmlns={SVG_NS} width="100%" height="100%" viewBox={`0 0 ${Math.max(1, dimensions.width)} ${Math.max(1, dimensions.height)}`}
      preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      {scenes.outgoing && <SceneView key={`out-${scenes.outgoing.id}`} scene={scenes.outgoing} stageId={stageId}
        params={scenes.outgoing.params} playing={playing} reducedMotion={actualReduced} delayMs={0} transition={transition} outgoing
        onExit={() => setScenes(current => current.outgoing?.id === scenes.outgoing?.id ? { ...current, outgoing: null } : current)} />}
      {scenes.outgoing && scenes.current && transition === 'line' && !actualReduced &&
        <BridgeLine from={scenes.outgoing.geometry} to={scenes.current.geometry} playing={playing} stageId={stageId} />}
      {scenes.current && <SceneView key={scenes.current.id} scene={scenes.current} stageId={stageId} params={params}
        playing={playing} reducedMotion={actualReduced} delayMs={scenes.delay} transition={transition} onComplete={onComplete} />}
    </svg>
  </div>;
}

export default LivingTypeStage;
