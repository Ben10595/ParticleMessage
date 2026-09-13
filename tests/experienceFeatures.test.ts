import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, validateMessage } from '../types/message';
import { remapSecrets } from '../types/experience';
import { advanceHold } from '../particles/reveal';

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
