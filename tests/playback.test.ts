import test from 'node:test';
import assert from 'node:assert/strict';
import { characterDelay, graphemes, isMessageExpired, LINK_LIFETIME_MS, typingTimeline } from '../lib/playback';
import { DEFAULT_SETTINGS, EFFECTS, validateMessage, WRITING_PRESETS } from '../types/message';

test('typing respects sentence, comma, paragraph pauses and emoji clusters', () => {
  const writing = { enabled: true, ...WRITING_PRESETS.Normal };
  assert.deepEqual(graphemes('A❤️👨‍👩‍👧‍👦🇩🇪'), ['A', '❤️', '👨‍👩‍👧‍👦', '🇩🇪']);
  assert.equal(characterDelay('.', writing), 495);
  assert.equal(characterDelay('!', writing), characterDelay('?', writing));
  assert.ok(characterDelay(',', writing) < characterDelay('.', writing));
  assert.ok(characterDelay('\n', writing) > characterDelay('.', writing));
  assert.deepEqual(typingTimeline('A.\n❤️', writing), [0, 75, 570, 1445]);
});
test('expiry is exactly 72 hours, independent of timezone and fails closed for invalid dates', () => {
  const created = '2026-09-06T12:00:00.000Z';
  const deadline = Date.parse(created) + LINK_LIFETIME_MS;
  assert.equal(isMessageExpired(created, deadline - 1), false);
  assert.equal(isMessageExpired(created, deadline), true);
  assert.equal(isMessageExpired('2026-09-06T14:00:00+02:00', deadline), true);
  for (const value of [undefined, null, '', 'invalid']) assert.equal(isMessageExpired(value, deadline), true);
  assert.equal(isMessageExpired('2099-01-01T00:00:00Z', deadline), true);
});
test('old messages stay compatible; all new effects and writing settings round-trip', () => {
  for (const effect of EFFECTS) {
    const content = { version: 1, slides: [{ text: 'Hallo ✨', duration: 2000, effect }], settings: { ...DEFAULT_SETTINGS, effect, finale: true } };
    assert.deepEqual(validateMessage(content), content);
  }
  const old = { version: 1, slides: [{ text: 'Hallo', duration: 2000 }] };
  assert.deepEqual(validateMessage(old), old);
});
test('untrusted animation settings are bounded and strictly typed', () => {
  const valid = { version: 1, slides: [{ text: 'Hallo', duration: 2000 }], settings: DEFAULT_SETTINGS };
  for (const writing of [{ enabled: 'true' }, { speed: Infinity }, { speed: 19 }, { punctuationPause: -1 }, { paragraphPause: 4001 }]) {
    assert.throws(() => validateMessage({ ...valid, settings: { ...DEFAULT_SETTINGS, writing: { ...DEFAULT_SETTINGS.writing, ...writing } } }));
  }
  assert.throws(() => validateMessage({ ...valid, settings: { ...DEFAULT_SETTINGS, effect: 'invalid' } }));
  assert.throws(() => validateMessage({ ...valid, slides: [{ ...valid.slides[0], effect: 'invalid' }] }));
});
