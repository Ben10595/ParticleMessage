import type { Target } from './targetGenerators';
import { graphemes } from '../lib/playback';
let canvas: HTMLCanvasElement | undefined;
export function wrapText(ctx: Pick<CanvasRenderingContext2D, 'measureText'>, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= width) { line = next; continue; }
      if (line) { lines.push(line); line = ''; }
      for (const char of graphemes(word)) {
        if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = ''; }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}
export interface TextOptions { x: number; y: number; width: number; height: number; fontSize: number; align?: 'left' | 'center'; weight?: number; spacing?: number; fit?: boolean; opacity?: number; nowrap?: boolean; verticalAlign?: 'top' | 'center' }
export interface Glyph { text: string; index: number; x: number; y: number; width: number; emoji: boolean }
export interface TextLayout { targets: Target[]; glyphs: Glyph[]; cursors: { x: number; y: number }[]; fontSize: number; count: number }
const cache = new Map<string, TextLayout>();
const emojiPattern = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u;
export function createTextLayout(text: string, options: TextOptions): TextLayout {
  const { x, y, width, height, align = 'center', weight = 600, fit = false, opacity = 1 } = options;
  if (!text || width < 1 || height < 1) return { targets: [], glyphs: [], cursors: [], fontSize: options.fontSize, count: 0 };
  const key = JSON.stringify([text, Math.round(width), Math.round(height), options.fontSize, align, weight, options.spacing, fit, options.verticalAlign, options.nowrap]);
  let layout = cache.get(key);
  if (!layout) {
    canvas ??= document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas ist in diesem Browser nicht verfügbar.');
    const characters = graphemes(text);
    let fontSize = options.fontSize;
    let lines: { text: string; index: number }[][] = [];
    do {
      ctx.font = `${weight} ${fontSize}px Arial, sans-serif`;
      if (options.nowrap && ctx.measureText(text).width > width && fontSize > 8) { fontSize -= .5; continue; }
      lines = [[]];
      let lineWidth = 0;
      for (let index = 0; index < characters.length; index++) {
        const char = characters[index];
        if (char === '\n') { lines[lines.length - 1].push({ text: char, index }); lines.push([]); lineWidth = 0; continue; }
        const charWidth = ctx.measureText(char).width;
        // Wrap whole words when possible, then split long unbroken strings by grapheme.
        if (char !== ' ' && (index === 0 || /[\s]/u.test(characters[index - 1]))) {
          let word = char;
          for (let j = index + 1; j < characters.length && !/\s/u.test(characters[j]); j++) word += characters[j];
          if (!options.nowrap && lineWidth > 0 && lineWidth + ctx.measureText(word).width > width + .5) { lines.push([]); lineWidth = 0; }
        }
        if (!options.nowrap && lineWidth + charWidth > width + .5 && lineWidth > 0) { lines.push([]); lineWidth = 0; }
        lines[lines.length - 1].push({ text: char, index }); lineWidth += charWidth;
      }
      if (!fit || lines.length * fontSize * 1.35 <= height || fontSize <= 8) break;
      fontSize -= 1;
    } while (true);
    const spacing = options.spacing ?? Math.max(1.15, Math.min(3.25, fontSize / 30));
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
      const lineWidth = line.reduce((sum, char) => sum + (char.text === '\n' ? 0 : ctx.measureText(char.text).width), 0);
      let left = align === 'center' ? (width - lineWidth) / 2 : 0;
      line.forEach(char => {
        const glyphWidth = char.text === '\n' ? 0 : ctx.measureText(char.text).width;
        const glyph = { ...char, x: left, y: top + row * lineHeight, width: glyphWidth, emoji: emojiPattern.test(char.text) };
        cursors[char.index] = { x: left, y: glyph.y };
        glyphs.push(glyph);
        if (!glyph.emoji && char.text !== '\n') ctx.fillText(char.text, left, glyph.y);
        left += glyphWidth;
        cursors[char.index + 1] = { x: left + 2, y: glyph.y };
      });
    });
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const targets: Target[] = [];
    for (const glyph of glyphs) {
      if (glyph.emoji || /\s/u.test(glyph.text)) continue;
      for (let py = Math.max(0, Math.floor(glyph.y - fontSize * .65)), row = 0; py < Math.min(height, glyph.y + fontSize * .65); py += spacing, row++) {
        for (let px = Math.max(0, glyph.x), col = 0; px < Math.min(width, glyph.x + glyph.width); px += spacing, col++) {
          const alpha = pixels[(Math.floor(py * resolution) * canvas.width + Math.floor(px * resolution)) * 4 + 3] / 255;
          if (alpha > .35) targets.push({ x: px, y: py, size: spacing * (fontSize < 60 ? .47 : .41), opacity: Math.min(1, .75 + alpha * .25), key: `glyph-${glyph.index}-${row}-${col}`, glyph: glyph.index, delay: 0 });
        }
      }
    }
    layout = { targets, glyphs, cursors, fontSize, count: characters.length };
    if (cache.size >= 128) cache.delete(cache.keys().next().value!);
    cache.set(key, layout);
  }
  return { ...layout, targets: layout.targets.map(p => ({ ...p, x: p.x + x, y: p.y + y, opacity: (p.opacity ?? 1) * opacity })), glyphs: layout.glyphs.map(g => ({ ...g, x: g.x + x, y: g.y + y })), cursors: layout.cursors.map(c => ({ x: c.x + x, y: c.y + y })) };
}
export function createTextTargets(text: string, options: TextOptions): Target[] { return createTextLayout(text, options).targets; }
