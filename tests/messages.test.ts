import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FONT, DEFAULT_SETTINGS, EFFECTS, FONTS, slideSettings, validateMessage } from '../types/message';
import { generateSlug, insertWithRetry, SLUG_PATTERN } from '../lib/messages';
import { applyMood, suggestMood } from '../lib/messageMoods';
const valid = { version: 1 as const, slides: [{ text: ' Na du 👋 ', duration: 2200 }] };
test('mood presets and per-moment typography survive the shared message format', () => {
  const slides = [{ text: 'Du bist mir wichtig ❤️', duration: 2500, size: 'large' as const, align: 'left' as const }];
  const draft = applyMood(suggestMood(slides[0].text), DEFAULT_SETTINGS, slides);
  assert.equal(draft.settings.mood, 'memory');
  assert.equal(draft.slides[0].size, 'large');
  assert.equal(draft.slides[0].align, 'left');
  assert.equal(draft.slides[0].effect, 'dust');
  const saved = validateMessage({ version: 1, ...draft });
  assert.equal(saved.settings?.mood, 'memory');
  assert.equal(saved.settings?.background, 'aurora');
  assert.equal(slideSettings(saved.slides[0], saved.settings).size, 'large');
  assert.throws(() => validateMessage({ version: 1, slides: [{ ...slides[0], size: 'huge' }] }), /Schriftgröße/);
  assert.throws(() => validateMessage({ version: 1, slides: [{ ...slides[0], align: 'justify' }] }), /Textausrichtung/);
  assert.throws(() => validateMessage({ version: 1, slides, settings: { ...DEFAULT_SETTINGS, mood: 'unknown' } }), /Stimmung/);
  assert.throws(() => validateMessage({ version: 1, slides, settings: { ...DEFAULT_SETTINGS, background: 'rainbow' } }), /Hintergrund/);
  assert.throws(() => validateMessage({ version: 1, slides, settings: { ...DEFAULT_SETTINGS, sound: 'yes' } }), /Toneinstellung/);
});
test('fonts and animations survive validation and saving, with compatible legacy defaults', async () => {
  assert.equal(slideSettings(valid.slides[0]).font, DEFAULT_FONT);
  assert.equal(slideSettings(valid.slides[0], { ...DEFAULT_SETTINGS, font: 'mono' }).font, 'mono');
  assert.equal(slideSettings({ ...valid.slides[0], font: 'classic' }, { ...DEFAULT_SETTINGS, font: 'mono' }).font, 'classic');
  for (const font of FONTS) for (const effect of EFFECTS) {
    const content = { version: 1 as const, slides: [{ text: 'Hallo ❤️', duration: 1000, font, effect }], settings: { ...DEFAULT_SETTINGS, font } };
    const serialized = JSON.parse(JSON.stringify(content));
    assert.deepEqual(validateMessage(serialized), content);
    await insertWithRetry(content, async (_slug, saved) => { assert.deepEqual(saved, content); return { error: null }; });
  }
  for (const font of [null, '', 'comic', 1, {}, ['mono']]) {
    assert.throws(() => validateMessage({ ...valid, slides: [{ ...valid.slides[0], font }] }), /Schriftart/);
    assert.throws(() => validateMessage({ ...valid, settings: { ...DEFAULT_SETTINGS, font } }), /Schriftart/);
  }
});
test('validates and normalizes the versioned message format', () => {
  assert.deepEqual(validateMessage(valid), { version: 1, slides: [{ text: 'Na du 👋', duration: 2200 }] });
  for (const value of [null, {}, { version: 2, slides: valid.slides }, { version: 1, slides: [] }, { version: 1, slides: Array(16).fill(valid.slides[0]) }, { version: 1, slides: [{ text: ' ', duration: 2000 }] }, { version: 1, slides: [{ text: 'a'.repeat(151), duration: 2000 }] }, { version: 1, slides: [{ text: 'hello', duration: NaN }] }, { version: 1, slides: [{ text: 'hello', duration: 999 }] }, { version: 1, slides: [{ text: 'hello', duration: 10001 }] }]) assert.throws(() => validateMessage(value));
});
test('handles Unicode and HTML as ordinary text', () => {
  assert.equal(validateMessage({ version: 1, slides: [{ text: '👋'.repeat(150), duration: 1000 }] }).slides[0].text, '👋'.repeat(150));
  const html = '<script>alert(1)</script>';
  assert.equal(validateMessage({ version: 1, slides: [{ text: html, duration: 1000 }] }).slides[0].text, html);
});
test('slugs have 72 random bits and use URL safe characters', () => {
  const slugs = new Set(Array.from({ length: 1000 }, generateSlug));
  assert.equal(slugs.size, 1000);
  for (const slug of slugs) { assert.equal(slug.length, 12); assert.match(slug, SLUG_PATTERN); }
});
test('retries unique collisions, but stops after five attempts', async () => {
  let attempts = 0;
  assert.equal(await insertWithRetry(valid, async () => ({ error: ++attempts < 3 ? { code: '23505' } : null }), () => `slug${attempts}`), 'slug2');
  attempts = 0;
  await assert.rejects(insertWithRetry(valid, async () => { attempts++; return { error: { code: '23505' } }; }));
  assert.equal(attempts, 5);
});
test('does not retry permission errors or insert invalid content', async () => {
  let attempts = 0;
  await assert.rejects(insertWithRetry(valid, async () => { attempts++; return { error: { code: '42501' } }; }));
  assert.equal(attempts, 1);
  await assert.rejects(insertWithRetry({ version: 1, slides: [] }, async () => { attempts++; return { error: null }; }));
  assert.equal(attempts, 1);
});
test('explains network, RLS and missing-table save failures without exposing backend details', async () => {
  await assert.rejects(insertWithRetry(valid, async () => ({ error: { message: 'TypeError: fetch failed' } })), /NEXT_PUBLIC_SUPABASE_URL/);
  await assert.rejects(insertWithRetry(valid, async () => ({ error: { code: '42501' } })), /INSERT-Richtlinie/);
  await assert.rejects(insertWithRetry(valid, async () => ({ error: { code: 'PGRST205' } })), /public\.messages/);
});
