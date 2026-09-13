import { seed } from '../reveal';
import { COLORS, type Target } from './types';
export function sampleShape(shape: string, width: number, height: number): Target[] {
  const cx = width / 2, cy = height * .43, scale = Math.min(width * .28, height * .24, 190), result: Target[] = [];
  if (shape === 'gift') {
    // Isometric surfaces, a separate lid and two looped ribbons, all sampled as matter.
    const project = (x: number, y: number, z: number, part = 0) => result.push({ x: cx + (x - z) * scale * .8, y: cy + (x + z) * scale * .24 + y * scale, z: (x + z) * 30, radius: .95, alpha: .45 + seed(result.length) * .5, color: part ? COLORS.gold : COLORS.ivory, part });
    for (let x = -.65; x <= .65; x += .033) for (let y = -.4; y <= .6; y += .035) {
      if (seed(x * 991 + y * 772) > .34 || Math.abs(x) < .045) { project(x, y, .65); project(.65, y, x); }
    }
    for (let x = -.71; x <= .71; x += .035) for (let z = -.71; z <= .71; z += .035) project(x, -.47, z, 1);
    for (let i = 0; i < 440; i++) { const a = i / 220 * Math.PI * 2, side = i < 220 ? -1 : 1; project(side * .27 * (1 - Math.cos(a)), -.5 - Math.sin(a) ** 2 * .4, Math.sin(a) * .15, 1); }
    return result;
  }
  for (let i = 0; i < 2600; i++) {
    const a = seed(i + 70) * Math.PI * 2, fill = Math.sqrt(seed(i + 230));
    let x: number, y: number;
    if (shape === 'heart') { x = Math.sin(a) ** 3; y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16; }
    else if (shape === 'infinity') { x = Math.cos(a) / (1 + Math.sin(a) ** 2); y = Math.sin(a) * x; }
    else if (shape === 'smiley') {
      if (i < 1700) { x = Math.cos(a); y = Math.sin(a); }
      else if (i < 2200) { x = (i % 2 ? -.34 : .34) + Math.cos(a) * .035; y = -.25 + Math.sin(a) * .09; }
      else { x = Math.cos(a * .5) * .48; y = Math.sin(a * .5) * .38 + .12; }
    } else {
      const n = a / Math.PI * 5, j = Math.floor(n), t = n - j;
      const r = j % 2 ? .44 : 1, s = (j + 1) % 2 ? .44 : 1;
      x = Math.sin(j * Math.PI / 5) * r * (1 - t) + Math.sin((j + 1) * Math.PI / 5) * s * t;
      y = -Math.cos(j * Math.PI / 5) * r * (1 - t) - Math.cos((j + 1) * Math.PI / 5) * s * t;
    }
    const f = shape === 'infinity' || shape === 'smiley' ? .96 + fill * .04 : .18 + fill * .82;
    result.push({ x: cx + x * scale * f, y: cy + y * scale * f, z: (seed(i + 91) - .5) * 36, radius: .65 + seed(i) * .6, color: i % 5 ? COLORS.ivory : COLORS.gold, alpha: .4 + fill * .6 });
  }
  return result;
}
