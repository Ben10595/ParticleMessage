import { graphemes } from '../lib/playback';
import { curve, type Point } from './geometry';
// Original monoline alphabet. Coordinates use a 6 × 10 em grid. Curves are
// flattened once at layout time; the renderer follows their actual arc length.
const alphabet: Record<string, string> = {
  A:'0,9 3,0 6,9|1,6 5,6', B:'0,9 0,0 3,0 Q6,0 6,2.3 Q6,4.5 3,4.5 0,4.5|3,4.5 Q6,4.5 6,6.8 Q6,9 3,9 0,9',
  C:'6,1 Q4.5,0 3,0 Q0,0 0,4.5 Q0,9 3,9 Q4.5,9 6,8', D:'0,9 0,0 2,0 Q6,0 6,4.5 Q6,9 2,9 0,9', E:'6,0 0,0 0,9 6,9|0,4.5 4.8,4.5', F:'6,0 0,0 0,9|0,4.5 4.8,4.5',
  G:'6,1 Q4.5,0 3,0 Q0,0 0,4.5 Q0,9 3,9 Q6,9 6,6 6,5 3.5,5', H:'0,0 0,9|0,4.5 6,4.5|6,0 6,9', I:'1,0 5,0|3,0 3,9|1,9 5,9', J:'6,0 6,6 Q6,9 3,9 Q0,9 0,7',
  K:'0,0 0,9|6,0 0,5 6,9', L:'0,0 0,9 6,9', M:'0,9 0,0 3,5 6,0 6,9', N:'0,9 0,0 6,9 6,0', O:'3,0 Q0,0 0,4.5 Q0,9 3,9 Q6,9 6,4.5 Q6,0 3,0',
  P:'0,9 0,0 3,0 Q6,0 6,2.5 Q6,5 3,5 0,5', Q:'3,0 Q0,0 0,4.5 Q0,9 3,9 Q6,9 6,4.5 Q6,0 3,0|4,7 7,10', R:'0,9 0,0 3,0 Q6,0 6,2.5 Q6,5 3,5 0,5|3,5 6,9',
  S:'6,1 Q4.5,0 3,0 Q0,0 0,2 Q0,4 3,4.5 Q6,5 6,7 Q6,9 3,9 Q1,9 0,8', T:'0,0 6,0|3,0 3,9', U:'0,0 0,6 Q0,9 3,9 Q6,9 6,6 6,0', V:'0,0 3,9 6,0', W:'0,0 1.4,9 3,4.5 4.6,9 6,0', X:'0,0 6,9|6,0 0,9', Y:'0,0 3,4.5 6,0|3,4.5 3,9', Z:'0,0 6,0 0,9 6,9',
  a:'5,4 Q4,3 2.5,3 Q0,3 0,6 Q0,9 2.5,9 Q5,9 5,6 5,3 5,9', b:'0,0 0,9 0,6 Q0,3 2.5,3 Q5,3 5,6 Q5,9 2.5,9 Q0,9 0,7',
  c:'5,3.8 Q4,3 2.5,3 Q0,3 0,6 Q0,9 2.5,9 Q4,9 5,8.2', d:'5,0 5,9 5,6 Q5,3 2.5,3 Q0,3 0,6 Q0,9 2.5,9 Q5,9 5,7',
  e:'0,6 5,6 Q5,3 2.5,3 Q0,3 0,6 Q0,9 2.5,9 Q4,9 5,8', f:'1.5,9 1.5,2 Q1.5,0 4,0|0,3 4,3', g:'5,3 5,9 Q5,12 2.5,12 Q1,12 0,11|5,6 Q5,3 2.5,3 Q0,3 0,6 Q0,9 2.5,9 Q5,9 5,6',
  h:'0,0 0,9 0,5.5 Q0,3 2.5,3 Q5,3 5,5.5 5,9', i:'2,3 2,9|2,.5 2,.8', j:'3,3 3,10 Q3,12 0,12|3,.5 3,.8', k:'0,0 0,9|5,3 0,6 5,9', l:'1.5,0 1.5,7.5 Q1.5,9 3,9',
  m:'0,9 0,3 0,5 Q0,3 1.7,3 Q3.5,3 3.5,5 3.5,9 3.5,5 Q3.5,3 5.2,3 Q7,3 7,5 7,9', n:'0,9 0,3 0,5.5 Q0,3 2.5,3 Q5,3 5,5.5 5,9', o:'2.5,3 Q0,3 0,6 Q0,9 2.5,9 Q5,9 5,6 Q5,3 2.5,3',
  p:'0,12 0,3 0,6 Q0,3 2.5,3 Q5,3 5,6 Q5,9 2.5,9 Q0,9 0,6', q:'5,12 5,3 5,6 Q5,3 2.5,3 Q0,3 0,6 Q0,9 2.5,9 Q5,9 5,6', r:'0,9 0,3 0,5.5 Q0,3 4,3',
  s:'5,3.7 Q4,3 2.5,3 Q0,3 0,4.5 Q0,6 2.5,6 Q5,6 5,7.5 Q5,9 2.5,9 Q1,9 0,8.3', t:'2,0 2,7 Q2,9 4.5,9|0,3 4.5,3', u:'0,3 0,6.5 Q0,9 2.5,9 Q5,9 5,6.5 5,3 5,9', v:'0,3 2.5,9 5,3', w:'0,3 1.5,9 3.5,4 5.5,9 7,3', x:'0,3 5,9|5,3 0,9', y:'0,3 2.5,9|5,3 2,11 Q1.5,12 0,12', z:'0,3 5,3 0,9 5,9',
  '0':'3,0 Q0,0 0,4.5 Q0,9 3,9 Q6,9 6,4.5 Q6,0 3,0|1,7 5,2', '1':'1,2 3,0 3,9|1,9 5,9', '2':'0,2 Q0,0 3,0 Q6,0 6,2 Q6,4 0,9 6,9', '3':'0,1 Q2,0 3,0 Q6,0 6,2 Q6,4.5 3,4.5 Q6,4.5 6,7 Q6,9 3,9 Q1,9 0,8',
  '4':'5,9 5,0 0,6 6,6', '5':'6,0 0,0 0,4 3,4 Q6,4 6,6.5 Q6,9 3,9 Q1,9 0,8', '6':'6,1 Q4,0 3,0 Q0,0 0,6 Q0,9 3,9 Q6,9 6,6 Q6,3.5 3,3.5 Q0,3.5 0,6', '7':'0,0 6,0 1,9', '8':'3,4.5 Q0,4.5 0,2.3 Q0,0 3,0 Q6,0 6,2.3 Q6,4.5 3,4.5 Q0,4.5 0,6.7 Q0,9 3,9 Q6,9 6,6.7 Q6,4.5 3,4.5', '9':'6,3 Q6,0 3,0 Q0,0 0,3 Q0,5.5 3,5.5 Q6,5.5 6,3 6,6 Q6,9 3,9 Q1,9 0,8',
  '.':'1,8.8 1.2,9', ',':'1.5,8.5 0,11', ':':'1,3 1.2,3.2|1,8.8 1.2,9', ';':'1,3 1.2,3.2|1.5,8.5 0,11', '!':'1,0 1,6|1,8.8 1.2,9', '?':'0,2 Q0,0 2.5,0 Q5,0 5,2 Q5,3.5 2.5,5 2.5,6|2.5,8.8 2.7,9',
  '-':'0,5 4,5', '—':'0,5 8,5', '–':'0,5 6,5', '_':'0,10 6,10', '/':'0,10 5,0', '\\':'0,0 5,10', '+':'0,4.5 6,4.5|3,1.5 3,7.5', '=':'0,3 6,3|0,6 6,6', '×':'0,2 5,7|5,2 0,7',
  '(':'3,0 Q0,4.5 3,9', ')':'0,0 Q3,4.5 0,9', '[':'3,0 0,0 0,9 3,9', ']':'0,0 3,0 3,9 0,9', '"':'0,0 0,2|3,0 3,2', "'":'1,0 1,2', '…':'0,9 .2,9|3,9 3.2,9|6,9 6.2,9', '♥':'3,9 Q-2,5 0,2 Q1,0 3,2 Q5,0 6,2 Q8,5 3,9', '←':'6,5 0,5 3,2|0,5 3,8', '→':'0,5 6,5 3,2|6,5 3,8', '↗':'0,9 6,1 1,1|6,1 6,6', '✓':'0,5 2,8 6,1', '↻':'6,3 Q5,0 3,0 Q0,0 0,4.5 Q0,9 3,9 Q6,9 6,6|6,0 6,3 3,3', '↺':'0,3 Q1,0 3,0 Q6,0 6,4.5 Q6,9 3,9 Q0,9 0,6|0,0 0,3 3,3',
  'ß':'0,9 0,3 Q0,0 2.5,0 Q5,0 5,2 Q5,4 2.5,4 Q6,5 6,7 Q6,9 2.5,9',
};
const cache = new Map<string, Point[][] | null>();
function glyph(character: string): Point[][] | null {
  if (cache.has(character)) return cache.get(character)!;
  const normalized = character.normalize('NFD'), base = Array.from(normalized)[0];
  let source = alphabet[character] ?? alphabet[base];
  if (!source) { cache.set(character, null); return null; }
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
  cache.set(character, paths); return paths;
}
function advance(char: string): number {
  if (/\s/u.test(char)) return 4;
  if (/[il.,!':;]/u.test(char)) return 4;
  if (/[mwMW—]/u.test(char)) return 9;
  return glyph(char) ? 7.4 : 11;
}
export interface LineGlyph { char: string; index: number; paths: Point[][]; x: number; y: number; width: number; fallback: boolean }
export interface LineLayout { glyphs: LineGlyph[]; fontSize: number; lineCount: number; height: number }
export function layoutLineText(text: string, box: { x: number; y: number; width: number; height: number }, maxSize = 100, align = 'center'): LineLayout {
  const chars = graphemes(text);
  const wrap = (size: number) => {
    const rows: number[][] = [[]]; let width = 0;
    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === '\n') { rows.push([i]); width = 0; continue; }
      // Keep words together where possible; long words still break at graphemes.
      if (i === 0 || /\s/u.test(chars[i - 1])) {
        let word = 0;
        for (let j = i; j < chars.length && !/\s/u.test(chars[j]); j++) word += advance(chars[j]) * size / 10;
        if (width > 0 && word <= box.width && width + word > box.width) { rows.push([]); width = 0; }
      }
      const next = advance(chars[i]) * size / 10;
      if (width + next > box.width && width > 0) { rows.push([]); width = 0; }
      rows.at(-1)!.push(i); width += next;
    }
    return rows;
  };
  let size = Math.max(12, maxSize), rows = wrap(size);
  while ((rows.length * size * 1.5 > box.height || rows.some(row => row.reduce((n, i) => n + advance(chars[i]) * size / 10, 0) > box.width)) && size > 12) { size -= 1; rows = wrap(size); }
  const glyphs: LineGlyph[] = [], height = rows.length * size * 1.5;
  rows.forEach((row, line) => {
    const width = row.reduce((n, i) => n + (chars[i] === '\n' ? 0 : advance(chars[i]) * size / 10), 0);
    let x = box.x + (align === 'left' ? 0 : (box.width - width) / 2);
    const y = box.y + (box.height - height) / 2 + line * size * 1.5 + size * .2;
    for (const index of row) {
      const char = chars[index], source = /\s/u.test(char) ? [] : glyph(char), width = advance(char) * size / 10;
      glyphs.push({ char, index, x, y, width, fallback: source === null, paths: (source ?? []).map(path => path.map(p => ({ x: x + p.x * size / 10, y: y + p.y * size / 10 }))) });
      if (char !== '\n') x += width;
    }
  });
  return { glyphs, fontSize: size, lineCount: rows.length, height };
}
