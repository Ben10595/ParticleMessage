import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMessage } from '../types/message';
import { generateSlug, insertWithRetry, SLUG_PATTERN } from '../lib/messages';
import { wrapText } from '../particles/textSampler';
const valid = { version: 1 as const, slides: [{ text: ' Na du 👋 ', duration: 2200 }] };
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
test('wraps explicit newlines and unbroken strings within the available width', () => {
  const ctx = { measureText: (text: string) => ({ width: Array.from(text).length * 10 }) as TextMetrics };
  for (const text of ['Eine längere Nachricht mit Worten', 'x'.repeat(150), '👋'.repeat(30), 'Na du\n\nAlles gut?']) {
    const lines = wrapText(ctx, text, 80);
    assert.ok(lines.every(line => ctx.measureText(line).width <= 80));
  }
  assert.deepEqual(wrapText(ctx, 'Na du\n\nHallo', 80), ['Na du', '', 'Hallo']);
});
