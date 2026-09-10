import test from 'node:test';
import assert from 'node:assert/strict';
import { breakLines, createTextLayout } from '../particles/textSampler';
import { graphemes } from '../lib/playback';
import { createRectangleTargets } from '../particles/targetGenerators';

test('line breaks retain every grapheme and wrap words without leading spaces', () => {
  const text = 'Hallo Welt. 👨‍👩‍👧‍👦\nABCDEFGHIJKLMN';
  const characters = graphemes(text);
  const lines = breakLines(characters, () => 1, 6);
  assert.equal(lines[0].map(char => char.text).join(''), 'Hallo ');
  assert.equal(lines[1].map(char => char.text).join(''), 'Welt. ');
  assert.deepEqual(lines.flat().map(char => char.index), characters.map((_, index) => index));
  assert.deepEqual(lines.flat().map(char => char.text), characters);
  assert.ok(lines.every(line => line.filter(char => char.text !== '\n').length <= 6));
});

test('fit respects both axes, preserves glyph proportions and caches local coordinates only', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let reads = 0;
  const context = {
    font: '', setTransform() {}, fillText() {},
    measureText(text: string) { return { width: graphemes(text).length * Number(this.font.split(' ')[1].replace('px', '')) * .7 }; },
    getImageData() { reads++; return { data: new Uint8ClampedArray(surface.width * surface.height * 4) }; },
  };
  const surface = { width: 0, height: 0, getContext: () => context };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => surface } });
  try {
    const bounds = { x: 0, y: 0, width: 310, height: 210, fontSize: 64, fit: true };
    const layout = createTextLayout('W'.repeat(150), bounds);
    assert.ok(layout.fontSize >= 16 && layout.fontSize < 64);
    for (const glyph of layout.glyphs) {
      assert.ok(glyph.x >= 0 && glyph.x + glyph.width <= bounds.width + .01);
      assert.ok(glyph.y - layout.fontSize * .65 >= 0 && glyph.y + layout.fontSize * .65 <= bounds.height);
      assert.ok(Math.abs(glyph.width / layout.fontSize - .7) < .001, 'never squeeze horizontal advances');
    }
    const moved = createTextLayout('W'.repeat(150), { ...bounds, x: 50, y: 80 });
    assert.equal(reads, 1, 'moving a preview does not resample pixels');
    assert.equal(moved.glyphs[0].x, layout.glyphs[0].x + 50);
    assert.equal(moved.glyphs[0].y, layout.glyphs[0].y + 80);
    const multiline = createTextLayout('Hi\n', bounds);
    assert.ok(multiline.cursors.at(-1)!.y > multiline.glyphs[0].y, 'cursor follows a final newline');
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original); else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('dotted frame corners contain one point each', () => {
  const targets = createRectangleTargets(10, 20, 120, 44, 4);
  assert.equal(new Set(targets.map(point => `${point.x},${point.y}`)).size, targets.length);
});
