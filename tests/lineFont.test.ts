import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutLineText } from '../lines/lineFont';
import { contour, measure, pointAt } from '../lines/geometry';
import { scheduleStrokes, inkProgress } from '../lines/writing';
import { EFFECTS } from '../types/message';

test('line alphabet covers German text while emoji and other scripts remain readable', () => {
  const text = 'Schreib etwas. ÄÖÜ äöü ß!? 0123456789 ❤️ 👨‍👩‍👧‍👦 日本語';
  const layout = layoutLineText(text, { x: 20, y: 30, width: 900, height: 600 }, 50);
  assert.equal(layout.glyphs.filter(g => g.fallback).length, 5);
  assert.equal(layout.glyphs.filter(g => g.char === '👨‍👩‍👧‍👦').length, 1);
  for (const glyph of layout.glyphs) for (const path of glyph.paths) {
    assert.ok(path.length >= 2);
    assert.ok(path.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
  }
});
test('150 unbroken letters, paragraphs and mixed scripts fit mobile bounds without distortion', () => {
  for (const text of ['W'.repeat(150), 'Ein Gedanke.\n\nEine Linie. ❤️', '日本語 '.repeat(30)]) {
    const box = { x: 30, y: 100, width: 330, height: 400 };
    const layout = layoutLineText(text, box, 70);
    assert.ok(layout.fontSize >= 16);
    assert.ok(layout.height <= box.height);
    for (const glyph of layout.glyphs) for (const path of glyph.paths) for (const p of path) {
      assert.ok(p.x >= box.x - 1 && p.x <= box.x + box.width + 1);
      assert.ok(p.y >= box.y - 1 && p.y <= box.y + box.height + 1);
    }
  }
});
test('contours close and partial drawing follows distance instead of vertex count', () => {
  const shape = contour(10, 20, 100, 50, 5);
  assert.deepEqual(shape[0], shape.at(-1));
  const line = [{ x: 0, y: 0 }, { x: 90, y: 0 }, { x: 100, y: 0 }];
  const metrics = measure(line);
  assert.deepEqual(pointAt(line, metrics.lengths, metrics.length / 2), { x: 50, y: 0 });
});

test('pen strokes finish in order within a character slot, including dots and crossbars', () => {
  const layout = layoutLineText('Hi Äß!?', { x: 0, y: 0, width: 800, height: 300 }, 60);
  for (const glyph of layout.glyphs) for (const duration of [18, 65, 115, 230]) {
    const strokes = scheduleStrokes(glyph.paths, duration);
    for (let index = 0; index < strokes.length; index++) {
      const stroke = strokes[index];
      assert.ok(stroke.duration > 0);
      if (index) assert.ok(stroke.offset > strokes[index - 1].offset + strokes[index - 1].duration);
      assert.ok(stroke.offset + stroke.duration <= duration + .00001, 'the next letter cannot start before this stroke finishes');
    }
  }
  for (const effect of EFFECTS) {
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
      const progress = inkProgress(i / 100, effect);
      assert.ok(progress >= previous && progress <= 1, 'the pen advances without backtracking');
      previous = progress;
    }
    assert.equal(previous, 1);
  }
});
