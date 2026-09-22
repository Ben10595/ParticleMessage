import test from 'node:test';
import assert from 'node:assert/strict';
import { easeInOut, response, revealArc } from '../particles/matter/motion';

test('reveal paths have stationary endpoints and remain bounded when scrubbing a hold', () => {
  for (const fn of [easeInOut, revealArc]) {
    for (const end of [0, 1]) {
      const edge = end === 0 ? .0001 : .9999;
      assert.ok(Math.abs(fn(edge) - fn(end)) < 1e-9, 'no initial or final kick');
    }
  }
  assert.equal(easeInOut(-1), 0); assert.equal(easeInOut(2), 1);
  assert.equal(revealArc(0), 0); assert.equal(revealArc(1), 0);
  for (let n = 0; n <= 100; n++) {
    const t = n / 100;
    assert.ok(revealArc(t) >= 0 && revealArc(t) <= .5);
    if (n) assert.ok(easeInOut(t) >= easeInOut((n - 1) / 100));
  }
});

test('opacity, depth, tilt and pointer settling are independent of refresh rate and frame jitter', () => {
  for (const rate of [3.7, 5, 6, 9]) {
    const sequences = [30, 60, 90, 120, 144].map(hz => Array(hz).fill(1000 / hz) as number[]);
    sequences.push(Array.from({length: 40}, (_, n) => n % 2 ? 40 : 10));
    for (const frames of sequences) {
      let value = 0;
      for (const elapsed of frames) value += (1 - value) * response(elapsed, rate);
      assert.ok(Math.abs(value - (1 - Math.exp(-rate))) < 1e-12);
    }
  }
  assert.equal(response(0, 5), 0);
});
