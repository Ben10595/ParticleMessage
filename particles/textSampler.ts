import type { Target } from './targetGenerators';
import { graphemes } from '../lib/playback';
let canvas: HTMLCanvasElement | undefined;
export function wrapText(ctx: Pick<CanvasRenderingContext2D, 'measureText'>, text: string, width: number): string[] {
  return breakLines(graphemes(text), char => ctx.measureText(char).width, width).map(line => line.map(char => char.text).join('').replace(/\n$/, ''));
}
interface Character { text: string; index: number }
// Preserve original grapheme indices (including whitespace) for the typing clock.
// Spaces at a soft line break belong to the preceding line, never a new blank row.
export function breakLines(characters: string[], measure: (char: string) => number, width: number, nowrap = false): Character[][] {
  const lines: Character[][] = [[]];
  let used = 0;
  for (let index = 0; index < characters.length; index++) {
    const text = characters[index];
    if (text === '\n') { lines.at(-1)!.push({ text, index }); lines.push([]); used = 0; continue; }
    const size = measure(text);
    if (!nowrap && !/\s/u.test(text)) {
      if (index === 0 || /\s/u.test(characters[index - 1])) {
        let wordWidth = size;
        for (let i = index + 1; i < characters.length && !/\s/u.test(characters[i]); i++) wordWidth += measure(characters[i]);
        if (used > 0 && used + wordWidth > width && wordWidth <= width) { lines.push([]); used = 0; }
      }
      if (used > 0 && used + size > width) { lines.push([]); used = 0; }
    }
    lines.at(-1)!.push({ text, index }); used += size;
  }
  return lines;
}
export interface TextOptions { x: number; y: number; width: number; height: number; fontSize: number; align?: 'left' | 'center'; weight?: number; spacing?: number; fit?: boolean; opacity?: number; nowrap?: boolean; verticalAlign?: 'top' | 'center'; dotMatrix?: boolean }
export interface Glyph { text: string; index: number; x: number; y: number; width: number; emoji: boolean }
export interface TextLayout { targets: Target[]; glyphs: Glyph[]; cursors: { x: number; y: number }[]; fontSize: number; count: number }
const cache = new Map<string, TextLayout>();
const emojiPattern = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u;
export function createTextLayout(text: string, options: TextOptions): TextLayout {
  const { x, y, width, height, align = 'center', weight = 600, fit = false, opacity = 1 } = options;
  if (!text || width < 1 || height < 1) return { targets: [], glyphs: [], cursors: [], fontSize: options.fontSize, count: 0 };
  const key = JSON.stringify([text, width, height, options.fontSize, align, weight, options.spacing, fit, options.verticalAlign, options.nowrap, options.dotMatrix]);
  let layout = cache.get(key);
  if (!layout) {
    canvas ??= document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas ist in diesem Browser nicht verfügbar.');
    const characters = graphemes(text);
    let fontSize = options.fontSize;
    let lines: Character[][] = [];
    let widths = new Map<string, number>();
    const measure = (char: string) => widths.get(char) ?? 0;
    const arrange = (size: number) => {
      ctx.font = `${weight} ${size}px Arial, sans-serif`;
      widths = new Map([...new Set(characters)].map(char => [char, char === '\n' ? 0 : ctx.measureText(char).width]));
      lines = breakLines(characters, measure, width, options.nowrap);
      return lines.length * size * 1.35 <= height && lines.every(line => line.reduce((sum, char) => sum + measure(char.text), 0) <= width + .01);
    };
    if (!arrange(fontSize) && fit) {
      let low = .5, high = fontSize;
      // Binary fitting measures real glyph advances, with no horizontal squeezing.
      for (let i = 0; i < 10; i++) { const middle = (low + high) / 2; if (arrange(middle)) low = middle; else high = middle; }
      fontSize = Math.floor(low * 4) / 4; arrange(fontSize);
    }
    const spacing = options.spacing ?? (options.dotMatrix ? Math.max(1.05, Math.min(1.5, fontSize / 13)) : Math.max(0.75, Math.min(1.4, fontSize / 44)));
    const resolution = 2;
    canvas.width = Math.ceil(width * resolution); canvas.height = Math.ceil(height * resolution);
    ctx.setTransform(resolution, 0, 0, resolution, 0, 0);
    ctx.font = `${weight} ${fontSize}px Arial, sans-serif`;
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
    const lineHeight = fontSize * 1.35;
    const top = options.verticalAlign === 'top' ? lineHeight / 2 : (height - lines.length * lineHeight) / 2 + lineHeight / 2;
    const glyphs: Glyph[] = [];
    const cursors: TextLayout['cursors'] = [];
    lines.forEach((line, row) => {
      let end = line.length;
      while (end > 0 && /\s/u.test(line[end - 1].text)) end--;
      const lineWidth = line.slice(0, end).reduce((sum, char) => sum + measure(char.text), 0);
      let left = align === 'center' ? (width - lineWidth) / 2 : 0;
      line.forEach((char, column) => {
        const glyphWidth = column >= end ? 0 : measure(char.text);
        const glyph = { ...char, x: left, y: top + row * lineHeight, width: glyphWidth, emoji: emojiPattern.test(char.text) };
        cursors[char.index] = { x: left, y: glyph.y };
        glyphs.push(glyph);
        if (!glyph.emoji && !/\s/u.test(char.text)) ctx.fillText(char.text, left, glyph.y);
        left += glyphWidth;
        cursors[char.index + 1] = { x: left, y: glyph.y };
      });
      // An explicit final newline must move the cursor to the empty next line.
      if (!line.length) cursors[characters.length] = { x: left, y: top + row * lineHeight };
    });
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const targets: Target[] = [];
    const alphaAt = (px: number, py: number) => {
      const sx = Math.floor(px * resolution), sy = Math.floor(py * resolution);
      return sx < 0 || sy < 0 || sx >= canvas!.width || sy >= canvas!.height ? 0 : pixels[(sy * canvas!.width + sx) * 4 + 3] / 255;
    };
    for (const glyph of glyphs) {
      if (glyph.emoji || /\s/u.test(glyph.text)) continue;
      // One baseline-aligned lattice across each row. Four subpixel samples retain
      // thin strokes and smooth curves without random jitter or isolated edge noise.
      const top = Math.max(0, glyph.y - fontSize * .65);
      for (let py = top + spacing / 2, row = 0; py < Math.min(height, glyph.y + fontSize * .65); py += spacing, row++) {
        const start = Math.ceil((glyph.x - spacing / 2) / spacing) * spacing + spacing / 2;
        for (let px = start, col = 0; px < Math.min(width, glyph.x + glyph.width); px += spacing, col++) {
          const offset = Math.min(.35, spacing * .2);
          const alpha = (alphaAt(px - offset, py - offset) + alphaAt(px + offset, py - offset) + alphaAt(px - offset, py + offset) + alphaAt(px + offset, py + offset)) / 4;
          if (alpha >= .20) targets.push({ x: px, y: py, size: spacing * (options.dotMatrix ? .44 : .48), opacity: 1, glow: true, key: `glyph-${glyph.index}-${row}-${col}`, glyph: glyph.index, delay: 0 });
        }
      }
    }
    layout = { targets, glyphs, cursors, fontSize, count: characters.length };
    if (cache.size >= 64) cache.delete(cache.keys().next().value!);
    cache.set(key, layout);
  }
  return { ...layout, targets: layout.targets.map(p => ({ ...p, x: p.x + x, y: p.y + y, opacity: (p.opacity ?? 1) * opacity })), glyphs: layout.glyphs.map(g => ({ ...g, x: g.x + x, y: g.y + y })), cursors: layout.cursors.map(c => ({ x: c.x + x, y: c.y + y })) };
}
export function createTextTargets(text: string, options: TextOptions): Target[] { return createTextLayout(text, options).targets; }
