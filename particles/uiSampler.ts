import { createTextLayout, type TextLayout } from './textSampler';
import { createLineTargets, createRectangleTargets, type Target } from './targetGenerators';
const keys = new WeakMap<HTMLElement, number>();
let nextKey = 0;
export interface UISample { targets: Target[]; layouts: TextLayout[]; exclusions: DOMRect[] }
// HTML remains the accessible hit surface. Only these explicitly marked elements
// are rasterized; inputs, helper text and native option menus stay readable.
export function sampleUI(root: HTMLElement, viewportHeight: number): UISample {
  const targets: Target[] = [], layouts: TextLayout[] = [], exclusions: DOMRect[] = [];
  root.querySelectorAll<HTMLElement>('[data-particle]').forEach(element => {
    if (element.closest('details:not([open])') && !element.closest('summary')) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom < -20 || rect.top > viewportHeight + 20 || !element.getClientRects().length) return;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    const kind = element.dataset.particle;
    if (!keys.has(element)) keys.set(element, nextKey++);
    const key = `ui-${keys.get(element)}`;
    const disabled = element.matches(':disabled') || Boolean(element.closest('[disabled]'));
    const pressed = element.matches(':active');
    const active = element.matches(':hover, :focus-visible, :focus-within') || element.getAttribute('aria-current') === 'step';
    const opacity = disabled ? .24 : active ? .92 : kind === 'frame' ? .34 : .65;
    const append = (points: Target[], suffix: string) => targets.push(...points.map((p, i) => ({ ...p, key: `${key}-${suffix}-${i}`, opacity, size: (p.size ?? .85) * (pressed ? 1.25 : active ? 1.08 : 1), delay: Math.min(220, i * .08) })));
    if (kind === 'frame' || kind === 'button' || kind === 'control') {
      append(createRectangleTargets(rect.x, rect.y, rect.width, rect.height, kind === 'frame' ? 5 : 3.6), 'edge');
      // Denser open corner brackets belong to the same pool as the sparse edges.
      const length = Math.min(18, rect.height * .3);
      for (const [corner, [x, y, dx, dy]] of [[rect.x, rect.y, 1, 1], [rect.right, rect.y, -1, 1], [rect.x, rect.bottom, 1, -1], [rect.right, rect.bottom, -1, -1]].entries()) {
        append([...createLineTargets(x, y, x + dx * length, y, 2.3), ...createLineTargets(x, y, x, y + dy * length, 2.3)], `corner-${corner}`);
      }
    }
    if (kind === 'line') { append(createLineTargets(rect.x, rect.y, rect.right, rect.y, 4), 'line'); return; }
    if (kind === 'switch') {
      append(createRectangleTargets(rect.x, rect.y, rect.width, rect.height, 3), 'switch');
      const checked = (element as HTMLInputElement).checked;
      const cx = rect.x + (checked ? rect.width - 9 : 9), cy = rect.y + rect.height / 2;
      const knob: Target[] = [];
      for (let y = -4; y <= 4; y += 2) for (let x = -4; x <= 4; x += 2) knob.push({ x: cx + x, y: cy + y, size: .8 });
      append(knob, 'knob'); return;
    }
    if (kind === 'range') {
      const input = element as HTMLInputElement;
      const progress = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
      const cy = rect.y + rect.height / 2, cx = rect.x + 6 + (rect.width - 12) * progress;
      append(createLineTargets(rect.x, cy, rect.right, cy, 3.6), 'track');
      append(createRectangleTargets(cx - 4, cy - 5, 8, 10, 2), 'thumb'); return;
    }
    if (kind === 'frame' || kind === 'control') return;
    const left = parseFloat(style.paddingLeft) || 0, right = parseFloat(style.paddingRight) || 0;
    const top = parseFloat(style.paddingTop) || 0, bottom = parseFloat(style.paddingBottom) || 0;
    const text = element.dataset.text ?? element.textContent ?? '';
    const fontSize = parseFloat(style.fontSize);
    // Small labels stay native; the surrounding structure still comes from particles.
    const native = fontSize < 18 && kind !== 'hero';
    element.dataset.particleNative = String(native);
    if (native) { exclusions.push(rect); return; }
    const layout = createTextLayout(text, { x: rect.x + left, y: rect.y + top, width: rect.width - left - right, height: rect.height - top - bottom, fontSize, weight: 600, spacing: fontSize < 24 ? 1 : undefined, align: style.textAlign === 'center' ? 'center' : 'left', fit: true });
    layouts.push(layout);
    targets.push(...layout.targets.map(p => ({ ...p, key: `${key}-${p.key}`, size: fontSize < 24 ? .49 : p.size, opacity: disabled ? .28 : 1, delay: (p.glyph ?? 0) * (kind === 'hero' ? 15 : 3) })));
    exclusions.push(rect);
  });
  root.querySelectorAll<HTMLElement>('input,textarea,small,.eyebrow,.field-meta,.expiry-note,.preview-meta,footer').forEach(element => {
    const rect = element.getBoundingClientRect(); if (rect.width && rect.height) exclusions.push(rect);
  });
  return { targets, layouts, exclusions };
}
