import type { MessageFont, TextAlign, TextSize } from '../../types/message';
import { hash01, textEnergy } from './livingType';

export interface LivingPoint { x: number; y: number; index: number; angle: number }
export interface LivingTextRow { text: string; x: number; y: number }
export interface LivingGeometry {
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  rows: LivingTextRow[];
  route: string;
  points: LivingPoint[];
  outline: LivingPoint[];
  bounds: { x: number; y: number; width: number; height: number };
}

export function livingFontFamily(font: MessageFont = 'classic'): string {
  if (font === 'handwriting') return '"Segoe Print", "Bradley Hand", cursive';
  if (font === 'editorial') return 'Georgia, "Times New Roman", serif';
  if (font === 'mono') return '"SFMono-Regular", Consolas, monospace';
  return '"Avenir Next", Avenir, "Helvetica Neue", Arial, sans-serif';
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const rows: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph) { rows.push(''); continue; }
    let line = '';
    for (const word of paragraph.split(/\s+/u)) {
      const proposal = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(proposal).width > maxWidth) { rows.push(line); line = word; }
      else line = proposal;
      if (ctx.measureText(line).width <= maxWidth) continue;
      // Long unbroken words still fit on narrow phones.
      let fragment = '';
      for (const letter of Array.from(line)) {
        if (fragment && ctx.measureText(fragment + letter).width > maxWidth) { rows.push(fragment); fragment = letter; }
        else fragment += letter;
      }
      line = fragment;
    }
    rows.push(line);
  }
  return rows;
}

function layout(
  ctx: CanvasRenderingContext2D, text: string, width: number, height: number,
  family: string, size: TextSize, align: TextAlign,
): { rows: LivingTextRow[]; fontSize: number; fontWeight: number } {
  const energy = textEnergy(text);
  const count = energy.graphemes;
  const weight = family.includes('Georgia') || family.includes('Segoe Print') ? 400 : 600;
  const sizeScale = size === 'large' ? 1.19 : size === 'small' ? .82 : 1;
  const maxWidth = width * (align === 'center' ? .86 : .9);
  let fontSize = Math.min(height * .29, width * (count < 18 ? .095 : .073), 112) * sizeScale * energy.scale;
  fontSize = Math.max(15, fontSize);
  let lines: string[] = [];
  for (let attempt = 0; attempt < 32; attempt++) {
    ctx.font = `${weight} ${fontSize}px ${family}`;
    lines = wrap(ctx, text, maxWidth);
    const tallest = lines.length * fontSize * 1.32;
    const widest = Math.max(0, ...lines.map(row => ctx.measureText(row).width));
    if (tallest <= height * .75 && widest <= maxWidth + 1) break;
    fontSize *= .94;
  }
  const lineHeight = fontSize * 1.32;
  const fullHeight = lines.length * lineHeight;
  const baseline = (height - fullHeight) / 2 + fontSize * .98;
  const rows = lines.map((row, index) => ({
    text: row,
    x: align === 'left' ? width * .05 : align === 'right' ? width * .95 : width * .5,
    y: baseline + index * lineHeight,
  }));
  return { rows, fontSize, fontWeight: weight };
}

function thin(mask: Uint8Array, width: number, height: number): void {
  // Bounded work keeps live typing responsive on phones.
  for (let iteration = 0; iteration < 14; iteration++) {
    let changes = 0;
    for (let pass = 0; pass < 2; pass++) {
      const remove: number[] = [];
      for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (!mask[i]) continue;
        const p0 = mask[i - width], p1 = mask[i - width + 1], p2 = mask[i + 1], p3 = mask[i + width + 1];
        const p4 = mask[i + width], p5 = mask[i + width - 1], p6 = mask[i - 1], p7 = mask[i - width - 1];
        const total = p0 + p1 + p2 + p3 + p4 + p5 + p6 + p7;
        if (total < 2 || total > 6) continue;
        const transitions = Number(!p0 && !!p1) + Number(!p1 && !!p2) + Number(!p2 && !!p3) + Number(!p3 && !!p4)
          + Number(!p4 && !!p5) + Number(!p5 && !!p6) + Number(!p6 && !!p7) + Number(!p7 && !!p0);
        if (transitions !== 1) continue;
        if (pass === 0 && p0 * p2 * p4) continue;
        if (pass === 0 && p2 * p4 * p6) continue;
        if (pass === 1 && p0 * p2 * p6) continue;
        if (pass === 1 && p0 * p4 * p6) continue;
        remove.push(i);
      }
      for (const i of remove) mask[i] = 0;
      changes += remove.length;
    }
    if (!changes) break;
  }
}

function skeletonRoute(mask: Uint8Array, width: number, height: number, sx: number, sy: number, baselines: number[]): string {
  const used = new Uint8Array(mask.length);
  const edgeUsed = new Set<number>();
  const dirs = [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1];
  const point = (i: number) => ({ x: (i % width + .5) * sx, y: (Math.floor(i / width) + .5) * sy });
  const neighbors = (i: number) => dirs.map(d => i + d).filter(j => j >= 0 && j < mask.length && mask[j] && Math.abs(j % width - i % width) <= 1);
  const components: Array<{ pixels: number[]; minX: number; minY: number; row: number }> = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || used[i]) continue;
    const queue = [i], component: number[] = [];
    let minX = width, minY = height, maxY = 0;
    used[i] = 1;
    for (let q = 0; q < queue.length; q++) {
      const at = queue[q]; component.push(at);
      minX = Math.min(minX, at % width);
      minY = Math.min(minY, Math.floor(at / width));
      maxY = Math.max(maxY, Math.floor(at / width));
      for (const next of neighbors(at)) if (!used[next]) { used[next] = 1; queue.push(next); }
    }
    if (component.length > 2) {
      const centerY = (minY + maxY) / 2;
      let row = 0;
      for (let r = 1; r < baselines.length; r++) if (Math.abs(centerY - baselines[r]) < Math.abs(centerY - baselines[row])) row = r;
      components.push({ pixels: component, minX, minY, row });
    }
  }
  components.sort((a, b) => a.row - b.row || a.minX - b.minX || a.minY - b.minY);
  const route: Array<{ x: number; y: number }> = [];
  for (const component of components) {
    let start = component.pixels[0];
    for (const i of component.pixels) {
      if (neighbors(i).length !== 1) continue;
      if (neighbors(start).length !== 1 || i % width < start % width || (i % width === start % width && i < start)) start = i;
    }
    type Frame = { at: number; previous: number | null; next: number[]; cursor: number };
    const frame = (at: number, previous: number | null): Frame => ({
      at, previous, cursor: 0,
      next: neighbors(at).sort((a, b) => {
        const deltaA = previous === null ? 0 : Math.abs((a - at) - (at - previous));
        const deltaB = previous === null ? 0 : Math.abs((b - at) - (at - previous));
        return deltaA - deltaB || a - b;
      }),
    });
    const stack: Frame[] = [frame(start, null)];
    route.push(point(start));
    while (stack.length) {
      const top = stack[stack.length - 1];
      if (top.cursor >= top.next.length) {
        stack.pop();
        if (stack.length) route.push(point(stack[stack.length - 1].at));
        continue;
      }
      const next = top.next[top.cursor++];
      const key = Math.min(top.at, next) * mask.length + Math.max(top.at, next);
      if (edgeUsed.has(key)) continue;
      edgeUsed.add(key);
      route.push(point(next));
      stack.push(frame(next, top.at));
    }
  }
  if (route.length < 2) return '';
  // Midpoint quadratic smoothing keeps one connected path without exposing raster stairs.
  const first = route[0];
  let d = `M${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  for (let i = 1; i < route.length - 1; i++) {
    const at = route[i], next = route[i + 1];
    d += `Q${at.x.toFixed(1)} ${at.y.toFixed(1)} ${((at.x + next.x) / 2).toFixed(1)} ${((at.y + next.y) / 2).toFixed(1)}`;
  }
  const end = route.at(-1)!;
  d += `L${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
  return d;
}

/** Rasterized glyph geometry shared by all ten SVG engines. */
export function buildLivingGeometry(
  text: string, displayWidth: number, displayHeight: number,
  font: MessageFont = 'classic', size: TextSize = 'medium', align: TextAlign = 'center',
  fontFamily?: string,
): LivingGeometry {
  const width = Math.max(1, Math.round(displayWidth));
  const height = Math.max(1, Math.round(displayHeight));
  const family = fontFamily || livingFontFamily(font);
  const source = makeCanvas(1, 1).getContext('2d');
  if (!source) throw new Error('Text geometry requires a 2D context');
  const measured = layout(source, text, width, height, family, size, align);
  const rasterWidth = Math.max(2, Math.min(760, Math.round(width)));
  const rasterHeight = Math.max(2, Math.min(460, Math.round(height)));
  const canvas = makeCanvas(rasterWidth, rasterHeight);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Text geometry requires a 2D context');
  ctx.scale(rasterWidth / width, rasterHeight / height);
  ctx.font = `${measured.fontWeight} ${measured.fontSize}px ${family}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = align;
  ctx.fillStyle = '#fff';
  for (const row of measured.rows) ctx.fillText(row.text, row.x, row.y);
  const pixels = ctx.getImageData(0, 0, rasterWidth, rasterHeight).data;
  const points: LivingPoint[] = [];
  const outline: LivingPoint[] = [];
  const step = Math.max(2, Math.ceil(Math.sqrt(rasterWidth * rasterHeight / 12000)));
  let minX = width, minY = height, maxX = 0, maxY = 0;
  const alpha = (x: number, y: number) => x < 0 || y < 0 || x >= rasterWidth || y >= rasterHeight ? 0 : pixels[(y * rasterWidth + x) * 4 + 3];
  for (let y = 1; y < rasterHeight - 1; y += step) for (let x = 1; x < rasterWidth - 1; x += step) {
    if (alpha(x, y) < 105) continue;
    const px = x * width / rasterWidth, py = y * height / rasterHeight;
    const index = y * rasterWidth + x;
    const angle = hash01(index) * Math.PI * 2;
    points.push({ x: px, y: py, index, angle });
    minX = Math.min(minX, px); maxX = Math.max(maxX, px);
    minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    if (alpha(x - step, y) < 100 || alpha(x + step, y) < 100 || alpha(x, y - step) < 100 || alpha(x, y + step) < 100) {
      outline.push({ x: px, y: py, index, angle });
    }
  }
  const skWidth = Math.max(2, Math.min(350, Math.round(width * .6)));
  const skHeight = Math.max(2, Math.min(210, Math.round(height * .6)));
  const skeletonCanvas = makeCanvas(skWidth, skHeight);
  const skeletonCtx = skeletonCanvas.getContext('2d', { willReadFrequently: true });
  let route = '';
  if (skeletonCtx) {
    skeletonCtx.drawImage(canvas, 0, 0, skWidth, skHeight);
    const data = skeletonCtx.getImageData(0, 0, skWidth, skHeight).data;
    const mask = new Uint8Array(skWidth * skHeight);
    for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 96 ? 1 : 0;
    thin(mask, skWidth, skHeight);
    route = skeletonRoute(mask, skWidth, skHeight, width / skWidth, height / skHeight,
      measured.rows.map(row => row.y * skHeight / height));
  }
  return {
    width, height, fontSize: measured.fontSize, fontFamily: family, fontWeight: measured.fontWeight,
    rows: measured.rows, route,
    points: points.length > 900 ? Array.from({ length: 900 }, (_, i) => points[Math.floor(i * points.length / 900)]) : points,
    outline: outline.length > 900 ? Array.from({ length: 900 }, (_, i) => outline[Math.floor(i * outline.length / 900)]) : outline,
    bounds: { x: minX < width ? minX : width * .2, y: minY < height ? minY : height * .4,
      width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) },
  };
}
