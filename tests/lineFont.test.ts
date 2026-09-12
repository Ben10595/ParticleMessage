import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutLineText } from '../lines/lineFont';
import { contour, measure, pointAt } from '../lines/geometry';
import { scheduleStrokes, inkProgress, entranceFrame } from '../lines/writing';
import { EFFECTS, FONTS } from '../types/message';

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

test('all selectable fonts have distinct paths, complete glyphs and fit narrow layouts', () => {
  const box = { x: 12, y: 30, width: 310, height: 400 };
  const signatures = FONTS.map(font => JSON.stringify(layoutLineText('Aa ilMW', box, 30, 'center', font).glyphs.map(g => g.paths)));
  assert.equal(new Set(signatures).size, FONTS.length);
  for (const font of FONTS) for (const text of ['W'.repeat(150), 'ÄÖÜ äöü ß é è ê\n👨‍👩‍👧‍👦 ❤️', 'Deine Worte machen meine Welt heller.']) {
    const layout = layoutLineText(text, box, 65, 'center', font);
    assert.ok(layout.height <= box.height);
    for (const glyph of layout.glyphs) for (const path of glyph.paths) for (const p of path) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.ok(p.x >= box.x - 1 && p.x <= box.x + box.width + 1, `${font} stays inside horizontal bounds`);
      assert.ok(p.y >= box.y - 1 && p.y <= box.y + box.height + 1, `${font} stays inside vertical bounds`);
    }
  }
  const mono = layoutLineText('Wi l.', box, 30, 'center', 'mono');
  assert.equal(new Set(mono.glyphs.map(g => g.width)).size, 1, 'mono preserves fixed character spacing');
});

test('entrance animations differ visibly and settle without residual motion', () => {
  const settled = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
  for (const effect of EFFECTS) {
    assert.deepEqual(entranceFrame(effect, 1), settled);
    assert.deepEqual(entranceFrame(effect, 2), settled);
    for (let i = 0; i <= 100; i++) {
      const frame = entranceFrame(effect, i / 100, 3);
      assert.ok(Object.values(frame).every(Number.isFinite));
      assert.ok(frame.opacity >= 0 && frame.opacity <= 1 && frame.scale > 0);
    }
  }
  const frames = ['morph', 'fade', 'rise', 'bloom'].map(effect => JSON.stringify(entranceFrame(effect as typeof EFFECTS[number], .25)));
  assert.equal(new Set(frames).size, frames.length);
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
