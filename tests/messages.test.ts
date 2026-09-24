import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FONT, DEFAULT_LIVING_TYPE_PARAMS, DEFAULT_SETTINGS, EFFECTS, FONTS, LIVING_TYPE_CONTROLS, LIVING_TYPE_ENGINES, LIVING_TYPE_PARAM_META, resolveLivingTypeParams, slideSettings, validateMessage } from '../types/message';
import { generateSlug, insertWithRetry, SLUG_PATTERN } from '../lib/messages';
import { applyMood, suggestMood } from '../lib/messageMoods';
const valid = { version: 1 as const, slides: [{ text: ' Na du 👋 ', duration: 2200 }] };
test('mood presets and per-moment typography survive the shared message format', () => {
  const slides = [{ text: 'Du bist mir wichtig ❤️', duration: 2500, size: 'large' as const, align: 'left' as const }];
  const draft = applyMood(suggestMood(slides[0].text), DEFAULT_SETTINGS, slides);
  assert.equal(draft.settings.mood, 'memory');
  assert.equal(draft.slides[0].size, 'large');
  assert.equal(draft.slides[0].align, 'left');
  assert.equal(slideSettings(draft.slides[0], draft.settings).effect, 'dust');
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
test('changing the mood keeps deliberately chosen animation and font on each moment', () => {
  const slides = [
    { text: 'Erster Moment', duration: 2500, effect: 'wave' as const, font: 'mono' as const },
    { text: 'Zweiter Moment', duration: 2500 },
  ];
  const draft = applyMood('dream', DEFAULT_SETTINGS, slides);
  assert.deepEqual(draft.slides, slides);
  assert.equal(slideSettings(draft.slides[0], draft.settings).effect, 'wave');
  assert.equal(slideSettings(draft.slides[0], draft.settings).font, 'mono');
  assert.equal(slideSettings(draft.slides[1], draft.settings).effect, 'bloom');
  assert.equal(slideSettings(draft.slides[1], draft.settings).font, 'handwriting');
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

test('Living Type engines and per-section controls survive storage without changing old messages', async () => {
  const legacy = validateMessage(valid);
  assert.equal(slideSettings(legacy.slides[0]).engine, 'particle');
  assert.deepEqual(slideSettings(legacy.slides[0]).engineParams, DEFAULT_LIVING_TYPE_PARAMS.particle);
  assert.equal(legacy.slides[0].engine, undefined, 'old JSON is not rewritten to a new engine');
  for (const engine of LIVING_TYPE_ENGINES) {
    for (const control of LIVING_TYPE_CONTROLS[engine]) {
      const meta = LIVING_TYPE_PARAM_META[control];
      assert.ok(DEFAULT_LIVING_TYPE_PARAMS[engine][control] >= meta.min && DEFAULT_LIVING_TYPE_PARAMS[engine][control] <= meta.max);
    }
    const key = LIVING_TYPE_CONTROLS[engine].find(control => control !== 'speed')!;
    const value = LIVING_TYPE_PARAM_META[key].min;
    const content = {
      version: 1 as const,
      slides: [{ text: `Engine ${engine}`, duration: 2800, engine, engineParams: { speed: 1.2, [key]: value } }],
    };
    const saved = validateMessage(JSON.parse(JSON.stringify(content)));
    assert.deepEqual(saved, content);
    assert.equal(slideSettings(saved.slides[0]).engine, engine);
    assert.equal(slideSettings(saved.slides[0]).engineParams[key], value);
    assert.deepEqual(slideSettings(saved.slides[0]).engineParams, resolveLivingTypeParams(engine, saved.slides[0].engineParams));
    await insertWithRetry(saved, async (_slug, stored) => {
      assert.deepEqual(stored, content);
      return { error: null };
    });
  }
});

test('Living Type rejects unknown engines, mismatched controls and unbounded values', () => {
  const slide = { text: 'Hallo', duration: 2800, engine: 'line' as const, engineParams: { lineWidth: 2.5 } };
  assert.deepEqual(validateMessage({ version: 1, slides: [slide] }).slides[0], slide);
  assert.throws(() => validateMessage({ version: 1, slides: [{ ...slide, engine: 'unknown' }] }), /Animation Engine/);
  assert.throws(() => validateMessage({ version: 1, slides: [{ ...slide, engine: undefined }] }), /Wähle zuerst/);
  assert.throws(() => validateMessage({ version: 1, slides: [{ ...slide, engineParams: { amount: 1 } }] }), /Regler passt nicht/);
  for (const value of [NaN, Infinity, -1, 6, '2', null]) {
    assert.throws(() => validateMessage({ version: 1, slides: [{ ...slide, engineParams: { lineWidth: value } }] }));
  }
  assert.throws(() => validateMessage({ version: 1, slides: [{ ...slide, engine: 'echo', engineParams: { count: 2.5 } }] }), /Echo-Anzahl/);
  assert.throws(() => validateMessage({ version: 1, slides: [{ ...slide, engineParams: [] }] }), /Einstellungen/);
  const lineParams = slideSettings(slide).engineParams;
  assert.equal(lineParams.lineWidth, 2.5);
  assert.equal(lineParams.morphSpeed, 1);
});
