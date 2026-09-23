import { graphemes } from '../../lib/playback';
import type { MessageFont } from '../../types/message';
import type { Box, Sample, Target } from './types';
const FAMILIES: Record<MessageFont, string> = { handwriting: '"Segoe Print", "Bradley Hand", cursive', classic: 'Arial, sans-serif', editorial: 'Georgia, serif', mono: '"Courier New", monospace' };
/** Bounded glyph raster cache. Sampling never occurs in the animation loop. */
export class TextSampler {
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  private cache = new Map<string, { x: number; y: number }[]>();
  sample(text: string, box: Box, maxSize = 90, font: MessageFont = 'classic', align = 'center', budget = 6500, family?: string, weight = '500'): Sample {
    const ctx = this.ctx;
    if (!ctx || box.width <= 0 || box.height <= 0) return { targets: [], glyphs: [], fontSize: 0, lineCount: 0 };
    const chars = graphemes(text), widths: number[] = [];
    const fontFamily = family ?? FAMILIES[font];
    const wrap = (size: number) => {
      ctx.font = `${weight} ${size}px ${fontFamily}`;
      chars.forEach((c, i) => { widths[i] = c === '\n' ? 0 : ctx.measureText(c).width; });
      const rows: number[][] = [[]]; let w = 0;
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] === '\n') { rows.push([i]); w = 0; continue; }
        if (!i || /\s/u.test(chars[i - 1])) {
          let word = 0;
          for (let j = i; j < chars.length && !/\s/u.test(chars[j]); j++) word += widths[j];
          if (w > 0 && word <= box.width && w + word > box.width) { rows.push([]); w = 0; }
        }
        if (w > 0 && w + widths[i] > box.width && !/\s/u.test(chars[i])) { rows.push([]); w = 0; }
        rows.at(-1)!.push(i); w += widths[i];
      }
      return rows;
    };
    let size = Math.floor(Math.min(maxSize, box.height / 1.28)), rows = wrap(size);
    while ((rows.length * size * 1.28 > box.height || Math.max(...widths) > box.width) && size > 12) { size -= 1; rows = wrap(size); }
    const result: Sample = { targets: [], glyphs: [], fontSize: size, lineCount: rows.length };
    const gap = Math.max(1.05, Math.min(3.1, size / 24));
    const rasterScale = 3;
    let offset = 0;
    const offsets = chars.map(char => { const at = offset; offset += char.length; return at; });
    rows.forEach((row, r) => {
      const rowWidth = row.reduce((n, i) => n + widths[i], 0);
      let x = box.x + (align === 'left' ? 0 : align === 'right' ? box.width - rowWidth : (box.width - rowWidth) / 2);
      const y = box.y + (box.height - rows.length * size * 1.28) / 2 + r * size * 1.28;
      row.forEach(i => {
        result.glyphs.push({ index: i, start: offsets[i], end: offsets[i] + chars[i].length, x, y, width: widths[i], height: size * 1.28 });
        if (!/\s/u.test(chars[i])) {
          const key = `${chars[i]}|${size}|${fontFamily}|${weight}|${gap}`;
          let points = this.cache.get(key);
          if (!points) {
            const pad = Math.ceil(size * .25);
            this.canvas.width = Math.ceil((widths[i] + pad * 2) * rasterScale);
            this.canvas.height = Math.ceil(size * 1.7 * rasterScale);
            ctx.scale(rasterScale, rasterScale); ctx.font = `${weight} ${size}px ${fontFamily}`;
            ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff'; ctx.fillText(chars[i], pad, size);
            const pixels = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
            points = [];
            const step = Math.max(2, Math.round(gap * rasterScale));
            for (let py = 0; py < this.canvas.height; py += step) for (let px = 0; px < this.canvas.width; px += step) {
              if (pixels[(py * this.canvas.width + px) * 4 + 3] > 65) points.push({ x: px / rasterScale - pad, y: py / rasterScale });
            }
            if (this.cache.size >= 512) this.cache.delete(this.cache.keys().next().value!);
            this.cache.set(key, points);
          }
          for (const p of points) result.targets.push({ x: x + p.x, y: y + p.y, glyph: i, radius: gap * .35, alpha: .94 });
        }
        x += widths[i];
      });
    });
    if (result.targets.length > budget) {
      const ratio = result.targets.length / budget;
      result.targets = Array.from({ length: budget }, (_, i) => ({ ...result.targets[Math.floor(i * ratio)], radius: gap * .35 * Math.sqrt(ratio) }));
    }
    return result;
  }
  /** Local image/canvas input shares the same target format and morph pool. */
  image(source: CanvasImageSource, box: Box, budget = 6000): Target[] {
    if (!this.ctx) return [];
    this.canvas.width = Math.max(1, Math.min(1024, Math.round(box.width)));
    this.canvas.height = Math.max(1, Math.min(1024, Math.round(box.height)));
    const w = this.canvas.width, h = this.canvas.height, ctx = this.ctx;
    ctx.drawImage(source, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h).data;
    const gap = Math.max(2, Math.ceil(Math.sqrt(w * h / budget))), targets: Target[] = [];
    for (let y = 0; y < h; y += gap) for (let x = 0; x < w; x += gap) {
      const n = (y * w + x) * 4;
      if (pixels[n + 3] > 65) targets.push({ x: box.x + x / w * box.width, y: box.y + y / h * box.height, radius: gap * .36, color: [pixels[n] / 255, pixels[n + 1] / 255, pixels[n + 2] / 255], alpha: pixels[n + 3] / 255 });
    }
    return targets;
  }
}
