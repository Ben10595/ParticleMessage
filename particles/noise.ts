// Seeded gradient Perlin noise; quintic interpolation keeps velocity continuous
// across lattice boundaries. No allocations or random numbers in the frame loop.
const permutation = new Uint8Array(512);
const shuffled = Uint8Array.from({ length: 256 }, (_, i) => i);
let seed = 0x70617274;
for (let i = 255; i > 0; i--) {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  const j = (seed >>> 0) % (i + 1);
  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}
for (let i = 0; i < 512; i++) permutation[i] = shuffled[i & 255];
export const smoothstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
function gradient(hash: number, x: number, y: number) {
  switch (hash & 7) {
    case 0: return x; case 1: return -x; case 2: return y; case 3: return -y;
    case 4: return (x + y) * Math.SQRT1_2; case 5: return (x - y) * Math.SQRT1_2;
    case 6: return (-x + y) * Math.SQRT1_2; default: return (-x - y) * Math.SQRT1_2;
  }
}
export function perlin2(x: number, y: number): number {
  const floorX = Math.floor(x), floorY = Math.floor(y);
  const ix = floorX & 255, iy = floorY & 255;
  x -= floorX; y -= floorY;
  const u = smoothstep(x), v = smoothstep(y);
  const a = permutation[ix] + iy, b = permutation[ix + 1] + iy;
  const topLeft = gradient(permutation[a], x, y), topRight = gradient(permutation[b], x - 1, y);
  const bottomLeft = gradient(permutation[a + 1], x, y - 1), bottomRight = gradient(permutation[b + 1], x - 1, y - 1);
  return (topLeft + u * (topRight - topLeft)) * (1 - v) + (bottomLeft + u * (bottomRight - bottomLeft)) * v;
}
