import test from 'node:test';
import assert from 'node:assert/strict';
import { characterDelay, effectDuration, effectTimeline, graphemes, isMessageExpired, LINK_LIFETIME_MS, livingTypeTransition, typingTimeline, wordTimeline } from '../lib/playback';
import { DEFAULT_SETTINGS, EFFECTS, LIVING_TYPE_ENGINES, validateMessage, WRITING_PRESETS } from '../types/message';

test('typing respects sentence, comma, paragraph pauses and emoji clusters', () => {
  const writing = { enabled: true, ...WRITING_PRESETS.Normal };
  assert.deepEqual(graphemes('A❤️👨‍👩‍👧‍👦🇩🇪'), ['A', '❤️', '👨‍👩‍👧‍👦', '🇩🇪']);
  assert.equal(characterDelay('.', writing), 495);
  assert.ok(characterDelay('!', writing) < characterDelay('?', writing));
  assert.ok(characterDelay(',', writing) < characterDelay('.', writing));
  assert.ok(characterDelay('\n', writing) > characterDelay('.', writing));
  const times = typingTimeline('A.\n❤️', writing);
  assert.equal(times[0], 0);
  assert.ok(times[1] >= 66 && times[1] <= 84);
  assert.ok(times[2] - times[1] > 480);
  assert.ok(times[3] - times[2] > 860);
  assert.deepEqual(times, typingTimeline('A.\n❤️', writing), 'preview and viewer use reproducible timing');
});
test('word reveals group letters and separate words, including after line breaks', () => {
  assert.deepEqual(wordTimeline('Hi du\n❤️!', 100), [0, 0, 0, 100, 100, 100, 200, 200]);
});
test('nine reveal presets have distinct, bounded schedules and preserve emoji clusters', () => {
  const text = 'Hi ❤️ du\njetzt';
  const writing = { enabled: false, ...WRITING_PRESETS.Normal };
  const typewriter = effectTimeline(text, 'typewriter', writing);
  const words = effectTimeline(text, 'wordByWord', writing);
  const floating = effectTimeline(text, 'floatingWords', writing);
  assert.equal(typewriter.length, graphemes(text).length);
  assert.ok(typewriter[1] > typewriter[0]);
  assert.ok(typewriter.at(-1)! < 3201);
  assert.equal(words[0], words[1]);
  assert.equal(words[3], words[4], 'an emoji remains part of one word');
  assert.ok(words[3] > words[0]);
  assert.ok(floating.at(-1)! > words.at(-1)!);
  assert.ok(effectDuration('typewriter') < effectDuration('wordByWord'));
  assert.ok(effectDuration('wordByWord') < effectDuration('floatingWords'));
  assert.ok(effectDuration('floatingWords') < effectDuration('wave'));
  assert.deepEqual(effectTimeline(text, 'wave', { ...writing, enabled: true }), typingTimeline(text, { ...writing, enabled: true }));
  assert.deepEqual(effectTimeline(text, 'typewriter', { ...writing, enabled: true }), typingTimeline(text, { ...writing, enabled: true }));
  assert.deepEqual(effectTimeline(text, 'fade', writing), graphemes(text).map(() => 0));
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
test('adjacent Living Type engines select a stable bridge animation', () => {
  assert.equal(livingTypeTransition('line', 'particle'), 'line');
  assert.equal(livingTypeTransition('liquid', 'draw'), 'line');
  assert.equal(livingTypeTransition('echo', 'void'), 'contour');
  assert.equal(livingTypeTransition('signal', 'echo'), 'contour');
  assert.equal(livingTypeTransition('particle', 'shatter'), 'dissolve');
  for (const from of LIVING_TYPE_ENGINES) for (const to of LIVING_TYPE_ENGINES) {
    assert.ok(['line', 'contour', 'dissolve'].includes(livingTypeTransition(from, to)));
  }
});
test('untrusted animation settings are bounded and strictly typed', () => {
  const valid = { version: 1, slides: [{ text: 'Hallo', duration: 2000 }], settings: DEFAULT_SETTINGS };
  for (const writing of [{ enabled: 'true' }, { speed: Infinity }, { speed: 19 }, { punctuationPause: -1 }, { paragraphPause: 4001 }]) {
    assert.throws(() => validateMessage({ ...valid, settings: { ...DEFAULT_SETTINGS, writing: { ...DEFAULT_SETTINGS.writing, ...writing } } }));
  }
  assert.throws(() => validateMessage({ ...valid, settings: { ...DEFAULT_SETTINGS, effect: 'invalid' } }));
  assert.throws(() => validateMessage({ ...valid, slides: [{ ...valid.slides[0], effect: 'invalid' }] }));
});

test('per-slide settings override global defaults and preserve distinct punctuation pauses', () => {
  const writing = { enabled: true, ...WRITING_PRESETS.Ruhig, commaPause: 50, periodPause: 200, questionPause: 900, exclamationPause: 300, paragraphPause: 1200 };
  const content = { version: 1, slides: [{ text: 'Hi, du. Ja? Wow!\n❤️', duration: 2500, effect: 'rain', writing }, { text: 'Ohne eigene Werte', duration: 1000 }], settings: DEFAULT_SETTINGS };
  assert.deepEqual(validateMessage(content), content);
  assert.deepEqual([',', '.', '?', '!', '\n'].map(char => characterDelay(char, writing)), [165, 315, 1015, 415, 1315]);
  for (const key of ['commaPause', 'periodPause', 'questionPause', 'exclamationPause']) assert.throws(() => validateMessage({ ...content, slides: [{ ...content.slides[0], writing: { ...writing, [key]: 2501 } }] }));
});
