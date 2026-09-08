import type { Target } from './targetGenerators';
const cache = new Map<string, Target[]>();
let canvas: HTMLCanvasElement | undefined;
export function wrapText(ctx: Pick<CanvasRenderingContext2D, 'measureText'>, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= width) { line = next; continue; }
      if (line) { lines.push(line); line = ''; }
      for (const char of Array.from(word)) {
        if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = ''; }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}
export interface TextOptions { x: number; y: number; width: number; height: number; fontSize: number; align?: 'left' | 'center'; weight?: number; spacing?: number; fit?: boolean; opacity?: number; verticalAlign?: 'top' | 'center' }
export function createTextTargets(text: string, options: TextOptions): Target[] {
  const { x, y, width, height, align = 'center', weight = 500, fit = false, opacity = .92 } = options;
  if (!text || width < 1 || height < 1) return [];
  canvas ??= document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas ist in diesem Browser nicht verfügbar.');
  let fontSize = options.fontSize;
  let lines: string[];
  do {
    ctx.font = `${weight} ${fontSize}px Arial, sans-serif`;
    lines = wrapText(ctx, text, width - 4);
    if (!fit || lines.length * fontSize * 1.3 <= height || fontSize <= 16) break;
    fontSize -= 2;
  } while (true);
  const spacing = options.spacing ?? (fontSize >= 50 ? 3.6 : fontSize >= 20 ? 2.3 : 1.65);
  const key = JSON.stringify([text, Math.round(width), Math.round(height), fontSize, align, weight, spacing, fit, options.verticalAlign]);
  let points = cache.get(key);
  if (!points) {
    canvas.width = Math.ceil(width); canvas.height = Math.ceil(height);
    ctx.font = `${weight} ${fontSize}px Arial, sans-serif`;
    ctx.fillStyle = '#fff'; ctx.textAlign = align; ctx.textBaseline = 'middle';
    const lineHeight = fontSize * 1.3;
    const top = options.verticalAlign === 'top' ? lineHeight / 2 : Math.max(lineHeight / 2, (height - lines.length * lineHeight) / 2 + lineHeight / 2);
    lines.forEach((line, i) => ctx.fillText(line, align === 'center' ? width / 2 : 2, top + i * lineHeight));
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    points = [];
    for (let py = 0; py < canvas.height; py += spacing) for (let px = 0; px < canvas.width; px += spacing) {
      if (pixels[(Math.floor(py) * canvas.width + Math.floor(px)) * 4 + 3] > 95) points.push({ x: px, y: py, size: spacing > 3 ? 1.1 : .9, delay: (py / Math.max(height, 1)) * 140 + px / width * 550 });
    }
    if (cache.size >= 45) cache.delete(cache.keys().next().value!);
    cache.set(key, points);
  }
  return points.map(point => ({ ...point, x: point.x + x, y: point.y + y, opacity }));
}
