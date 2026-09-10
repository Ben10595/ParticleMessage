import test from 'node:test';
import assert from 'node:assert/strict';
import { perlin2 } from '../particles/noise';

test('Perlin field is repeatable, bounded and smooth across lattice boundaries', () => {
  let min = Infinity, max = -Infinity;
  for (let x = -3; x < 3; x += .07) for (let y = -3; y < 3; y += .13) {
    const n = perlin2(x, y);
    assert.equal(n, perlin2(x, y));
    assert.ok(Math.abs(n) <= 1);
    assert.ok(Math.abs(n - perlin2(x + .001, y + .001)) < .01);
    min = Math.min(min, n); max = Math.max(max, n);
  }
  assert.ok(min < -.2 && max > .2, 'field varies in both directions');
  for (const x of [-2, -1, 0, 1, 2]) {
    const left = (perlin2(x, .37) - perlin2(x - .0001, .37)) / .0001;
    const right = (perlin2(x + .0001, .37) - perlin2(x, .37)) / .0001;
    assert.ok(Math.abs(left - right) < .01, 'no velocity kink at a cell edge');
  }
});
