import { graphemes } from '../lib/playback';
import { curve, type Point } from './geometry';
import { DEFAULT_FONT, type MessageFont } from '../types/message';
import { classicAlphabet, handwritingAlphabet, editorialAlphabet, monoAlphabet } from './alphabets';
const alphabets = { handwriting: handwritingAlphabet, classic: classicAlphabet, editorial: editorialAlphabet, mono: monoAlphabet };
const cache = new Map<string, Point[][] | null>();
const advances = new Map<string, number>();
function glyph(character: string, font: MessageFont): Point[][] | null {
  const key = `${font}:${character}`, alphabet = alphabets[font];
  if (cache.has(key)) return cache.get(key)!;
  const normalized = character.normalize('NFD'), base = Array.from(normalized)[0];
  let source = alphabet[character] ?? alphabet[base];
  if (!source) { cache.set(key, null); return null; }
  if (normalized.includes('\u0308')) source += base === base.toUpperCase() ? '|1,-2 1.2,-2|4,-2 4.2,-2' : '|1,1 1.2,1|4,1 4.2,1';
  if (normalized.includes('\u0301')) source += '|2,1 4,-1';
  if (normalized.includes('\u0300')) source += '|2,-1 4,1';
  if (normalized.includes('\u0302')) source += '|1,1 3,-1 5,1';
  const paths = source.split('|').map(part => {
    const tokens = part.match(/Q|[-\d.]+,[-\d.]+/g)!;
    const points: Point[] = [];
    const parse = (token: string) => { const [x, y] = token.split(',').map(Number); return { x, y }; };
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === 'Q') {
        const from = points.at(-1)!, control = parse(tokens[++i]), to = parse(tokens[++i]);
        points.push(...curve(from, { x: from.x + (control.x - from.x) * 2 / 3, y: from.y + (control.y - from.y) * 2 / 3 }, { x: to.x + (control.x - to.x) * 2 / 3, y: to.y + (control.y - to.y) * 2 / 3 }, to, 8).slice(1));
      } else points.push(parse(tokens[i]));
    }
    return points;
  });
  // Slant only letters; symbols and the small branding heart stay upright.
  const slanted = font === 'handwriting' && /\p{L}/u.test(base);
  const shaped = paths.map(path => path.map(p => ({ x: p.x * (font === 'editorial' ? .88 : font === 'mono' ? .9 : 1) + (slanted ? (9 - p.y) * .12 : 0), y: p.y })));
  const left = Math.min(...shaped.flatMap(path => path.map(p => p.x)));
  const right = Math.max(...shaped.flatMap(path => path.map(p => p.x)));
  const normalizedPaths = shaped.map(path => path.map(p => ({ x: p.x - left + (font === 'mono' ? (8 - (right - left)) / 2 : .35), y: p.y })));
  advances.set(key, font === 'mono' ? 8 : Math.max(3.1, right - left + (font === 'editorial' ? 1.3 : 1.65)));
  cache.set(key, normalizedPaths); return normalizedPaths;
}
function advance(char: string, font: MessageFont): number {
  if (/\s/u.test(char)) return font === 'mono' ? 8 : 3.8;
  if (!glyph(char, font)) return 11;
  return advances.get(`${font}:${char}`)!;
}
export interface LineGlyph { char: string; index: number; paths: Point[][]; x: number; y: number; width: number; fallback: boolean }
export interface LineLayout { glyphs: LineGlyph[]; fontSize: number; lineCount: number; height: number }
export function layoutLineText(text: string, box: { x: number; y: number; width: number; height: number }, maxSize = 100, align = 'center', font: MessageFont = DEFAULT_FONT): LineLayout {
  const chars = graphemes(text);
  const wrap = (size: number) => {
    const rows: number[][] = [[]]; let width = 0;
    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === '\n') { rows.push([i]); width = 0; continue; }
      // Keep words together where possible; long words still break at graphemes.
      if (i === 0 || /\s/u.test(chars[i - 1])) {
        let word = 0;
        for (let j = i; j < chars.length && !/\s/u.test(chars[j]); j++) word += advance(chars[j], font) * size / 10;
        if (width > 0 && word <= box.width && width + word > box.width) { rows.push([]); width = 0; }
      }
      const next = advance(chars[i], font) * size / 10;
      if (width + next > box.width && width > 0) { rows.push([]); width = 0; }
      rows.at(-1)!.push(i); width += next;
    }
    return rows;
  };
  let size = Math.max(12, maxSize), rows = wrap(size);
  while ((rows.length * size * 1.5 > box.height || rows.some(row => row.reduce((n, i) => n + advance(chars[i], font) * size / 10, 0) > box.width)) && size > 12) { size -= 1; rows = wrap(size); }
  const glyphs: LineGlyph[] = [], height = rows.length * size * 1.5;
  rows.forEach((row, line) => {
    const width = row.reduce((n, i) => n + (chars[i] === '\n' ? 0 : advance(chars[i], font) * size / 10), 0);
    let x = box.x + (align === 'left' ? 0 : (box.width - width) / 2);
    const y = box.y + (box.height - height) / 2 + line * size * 1.5 + size * .2;
    for (const index of row) {
      const char = chars[index], source = /\s/u.test(char) ? [] : glyph(char, font), width = advance(char, font) * size / 10;
      glyphs.push({ char, index, x, y, width, fallback: source === null, paths: (source ?? []).map(path => path.map(p => ({ x: x + p.x * size / 10, y: y + p.y * size / 10 }))) });
      if (char !== '\n') x += width;
    }
  });
  return { glyphs, fontSize: size, lineCount: rows.length, height };
}
