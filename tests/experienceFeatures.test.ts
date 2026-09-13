import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, EFFECTS, validateMessage } from '../types/message';
import { remapSecrets } from '../types/experience';
import { advanceHold, revealPoint } from '../particles/reveal';
import { SceneParticles, sampleLayout, secretBounds, shapeTargets } from '../particles/SceneParticles';
import { layoutLineText } from '../lines/lineFont';

test('all scene features round-trip, leading whitespace preserves secret selections, and legacy links work', () => {
  const message = validateMessage({ version: 1, slides: [{ text: '  Hallo Welt! ', duration: 2000, features: { hold: true, tilt: false, gift: 'orbit', puzzle: { kind: 'code', question: 'Unser Tag?', code: '007' }, secrets: [{ start: 8, end: 12, text: 'Nur für dich.', returnAfter: 5000 }] } }], settings: { ...DEFAULT_SETTINGS, finale: true, tilt: true, finaleConfig: { shape: 'text', text: 'Für immer', ending: 'explode', duration: 4000 } } });
  assert.equal(message.slides[0].text.slice(message.slides[0].features!.secrets![0].start, message.slides[0].features!.secrets![0].end), 'Welt');
  assert.deepEqual(validateMessage(JSON.parse(JSON.stringify(message))), message);
  assert.equal(validateMessage({ version: 1, slides: [{ text: 'Alt', duration: 1000 }] }).slides[0].features, undefined);
});

test('untrusted puzzles, modes, secrets and finale inputs are strictly bounded', () => {
  const check = (features: unknown) => validateMessage({ version: 1, slides: [{ text: 'Hi 👨‍👩‍👧‍👦 Welt', duration: 1000, features }] });
  for (const features of [null, { hold: 'yes' }, { gift: 'unknown' }, { puzzle: { kind: 'code', question: 'Code?', code: '1e3' } }, { puzzle: { kind: 'choice', question: 'Wahl?', answers: ['A', 'a'], correct: 0 } }, { puzzle: { kind: 'choice', question: 'Wahl?', answers: ['A', 'B'], correct: 2 } }, { secrets: [{ start: 3, end: 5, text: 'Nein', returnAfter: 5000 }] }, { secrets: [{ start: 0, end: 2, text: 'Nein', returnAfter: -1 }] }, { secrets: [{ start: 0, end: 2, text: 'A', returnAfter: 0 }, { start: 1, end: 2, text: 'B', returnAfter: 0 }] }]) assert.throws(() => check(features));
  assert.throws(() => validateMessage({ version: 1, slides: [{ text: 'Hi', duration: 1000 }], settings: { ...DEFAULT_SETTINGS, finale: true, finaleConfig: { shape: 'text', text: '', ending: 'float', duration: 4000 } } }));
});

test('secret editing retains untouched selections, shifts subsequent words, removes edited ranges', () => {
  const secrets = [{ start: 6, end: 10, text: 'Zusatz', returnAfter: 5000 }];
  assert.deepEqual(remapSecrets('Hallo Welt', 'Hey Hallo Welt', secrets), [{ ...secrets[0], start: 10, end: 14 }]);
  assert.deepEqual(remapSecrets('Hallo Welt', 'Hallo Welt!', secrets), secrets);
  assert.deepEqual(remapSecrets('Hallo Welt', 'Hallo Mensch', secrets), []);
});

test('hold reverses smoothly, caps at full reveal, stays locked, and reduced motion still needs a gesture', () => {
  assert.equal(advanceHold(0, false, 1000), 0);
  const progress = advanceHold(0, true, 1000);
  assert.ok(progress > 0 && progress < 1);
  assert.ok(advanceHold(progress, false, 500) < progress);
  assert.equal(advanceHold(.9, true, 500), 1);
  assert.equal(advanceHold(1, false, 100000), 1);
  assert.equal(advanceHold(0, false, 16, true), 0);
  assert.equal(advanceHold(0, true, 16, true), 1);
});

test('reveal paths share continuous exact endpoints; spiral, magnet, zoom and explosion differ', () => {
  const from = { x: 30, y: 60 }, to = { x: 300, y: 350 };
  for (const effect of EFFECTS) {
    assert.deepEqual(revealPoint(from, to, 0, effect, 1, 900, 700), from);
    assert.deepEqual(revealPoint(from, to, 1, effect, 1, 900, 700), to);
    const a = revealPoint(from, to, .4, effect, 1, 900, 700), b = revealPoint(from, to, .401, effect, 1, 900, 700);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 8);
  }
  assert.equal(new Set(['spiral', 'magnet', 'zoom', 'explosion'].map(effect => JSON.stringify(revealPoint(from, to, .3, effect as typeof EFFECTS[number], 3, 900, 700)))).size, 4);
});

test('sampled message and secret hit targets fit mobile bounds; gift includes a separate lid', () => {
  const text = 'Hallo meine Welt', layout = layoutLineText(text, { x: 30, y: 160, width: 330, height: 350 }, 60);
  const targets = sampleLayout(layout);
  assert.ok(targets.length > 100 && targets.length < 4200);
  assert.ok(targets.every(p => p.x >= 20 && p.x <= 370 && p.y > 150 && p.y < 520));
  const bounds = secretBounds(layout, text, [{ start: 6, end: 16, text: 'Zusatz', returnAfter: 0 }]);
  assert.ok(bounds.length > 0 && bounds.every(b => b.height >= 44 && b.width > 0));
  assert.ok(shapeTargets('gift', 390, 844).some(p => p.part === 'lid'));
});

test('pool budget, reduced-motion drawing, hold lock and release cleanup', () => {
  const pool = new SceneParticles(); let arcs = 0;
  const ctx = { beginPath() {}, moveTo() {}, arc() { arcs++; }, fill() {} } as unknown as CanvasRenderingContext2D;
  const targets = Array.from({ length: 10000 }, (_, i) => ({ x: i % 300, y: 100, glyph: 0, radius: 1, delay: 800 }));
  pool.form(targets, 100, 'spiral', 700, 390, 844, true);
  assert.ok(pool.count <= 4200);
  pool.setPressed(true); pool.draw(ctx, 101, 16, 390, 844, true);
  assert.equal(pool.holdProgress, 1); assert.ok(arcs > 0);
  pool.setPressed(false); pool.draw(ctx, 200, 100, 390, 844, true); assert.equal(pool.holdProgress, 1);
  pool.disperse(200, 390, 844); pool.draw(ctx, 201, 16, 390, 844, true); assert.equal(pool.count, 0);
  pool.form(targets.slice(0, 3), 300, 'wave', 700, 390, 844);
  arcs = 0; pool.draw(ctx, 301, 16, 390, 844, true); assert.equal(arcs, 3, 'reduced motion ignores every entrance delay');
});

test('held glyphs resist extreme sensor values and reduced motion ignores tilt', () => {
  const pool = new SceneParticles(); const positions: { x: number; y: number }[] = [];
  const ctx = { beginPath() {}, moveTo() {}, arc(x: number, y: number) { positions.push({ x, y }); }, fill() {} } as unknown as CanvasRenderingContext2D;
  pool.form([{ x: 100, y: 200, glyph: 0, radius: 1 }], 0, 'magnet', 700, 390, 844);
  pool.setTilt(1000, -1000); pool.draw(ctx, 1000, 1000, 390, 844, false);
  assert.ok(Math.abs(positions[0].x - 100) <= .65 && Math.abs(positions[0].y - 200) <= .65);
  positions.length = 0; pool.draw(ctx, 1016, 16, 390, 844, true);
  assert.deepEqual(positions[0], { x: 100, y: 200 });
});
