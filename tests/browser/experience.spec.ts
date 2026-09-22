import { test, expect, type Page } from '@playwright/test';
import { FONTS, FONT_LABELS, type MessageContent } from '../../types/message';
async function select(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
const content = { version: 1, slides: [{ text: 'Schön, dass es dich gibt. ❤️', duration: 4000 }, { text: 'Du machst den Unterschied. ✨', duration: 1000 }] };
async function unlock(page: Page) {
  await page.goto('/');
  await page.getByLabel('Passwort', { exact: true }).fill('particle-test');
  await page.getByRole('button', { name: 'Öffnen', exact: true }).click();
  await page.getByRole('button', { name: 'Nachricht erstellen', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'ABSCHNITT 01' })).toBeVisible();
}
async function mockMessage(page: Page, createdAt = new Date().toISOString(), message: unknown = content) {
  await page.route('**/rest/v1/messages*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: message, created_at: createdAt }) }));
}
test('font and animation choices preview, follow their section and survive the shared link', async ({ page }, testInfo) => {
  test.setTimeout(70000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await unlock(page);
  await page.getByRole('textbox', { name: 'ABSCHNITT 01' }).fill('Deine Worte. Äöü ❤️');
  await select(page, 'Dauer des fertigen Textes', '10 Sekunden');
  const canvas = page.locator('canvas');
  for (const font of FONTS) {
    await select(page, 'Schriftart dieses Abschnitts', FONT_LABELS[font]);
    await expect(canvas).toHaveAttribute('data-text-font', font);
    await expect(canvas).toHaveAttribute('data-phase', 'holding');
    await page.getByLabel('Live-Vorschau').scrollIntoViewIfNeeded();
    await page.getByLabel('Live-Vorschau').screenshot({ path: `test-results/font-${font}-${testInfo.project.name}.png` });
  }
  await select(page, 'Schriftart dieses Abschnitts', 'Editorial');
  await select(page, 'Animation dieses Abschnitts', 'Aufblühen');
  await expect(canvas).toHaveAttribute('data-text-font', 'editorial');
  await expect(canvas).toHaveAttribute('data-text-effect', 'bloom');
  await page.getByRole('button', { name: 'Abschnitt hinzufügen', exact: true }).click();
  await page.getByRole('textbox', { name: 'ABSCHNITT 02' }).fill('Zweiter Gedanke.');
  await expect(page.getByRole('combobox', { name: 'Schriftart dieses Abschnitts' })).toHaveText('Klar');
  await select(page, 'Schriftart dieses Abschnitts', 'Mono');
  await select(page, 'Animation dieses Abschnitts', 'Schreibmaschine');
  await page.getByRole('button', { name: 'Abschnitt nach vorne' }).click();
  await expect(page.getByRole('combobox', { name: 'Schriftart dieses Abschnitts' })).toHaveText('Mono');
  await page.getByRole('button', { name: 'Abschnitt 2', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Schriftart dieses Abschnitts' })).toHaveText('Editorial');
  await expect(page.getByRole('combobox', { name: 'Animation dieses Abschnitts' })).toHaveText('Aufblühen');
  let saved: MessageContent | undefined;
  await page.route('**/rest/v1/messages*', async route => {
    if (route.request().method() === 'POST') {
      saved = route.request().postDataJSON().content;
      await route.fulfill({ status: 201, body: '' });
    } else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: saved, created_at: new Date().toISOString() }) });
  });
  await page.getByRole('button', { name: 'Nachricht senden', exact: true }).click();
  const link = page.getByRole('textbox', { name: 'Link zu deiner Nachricht' });
  await expect(link).toBeVisible();
  expect(saved?.slides).toMatchObject([{ font: 'mono', effect: 'typewriter' }, { font: 'editorial', effect: 'bloom' }]);
  await page.goto(await link.inputValue());
  await expect(page.locator('.viewer-text')).toHaveText('Zweiter Gedanke.');
  await expect(canvas).toHaveAttribute('data-text-font', 'mono');
  await expect(canvas).toHaveAttribute('data-text-effect', 'typewriter');
  await expect(page.locator('.viewer-text')).toHaveText('Deine Worte. Äöü ❤️', { timeout: 10000 });
  await expect(canvas).toHaveAttribute('data-text-font', 'editorial');
  await expect(canvas).toHaveAttribute('data-text-effect', 'bloom');
  await expect(canvas).toHaveAttribute('data-phase', 'holding');
  await page.screenshot({ path: `test-results/styled-message-${testInfo.project.name}.png` });
  expect(errors).toEqual([]);
});
test('password rejection, signed httpOnly session, reload, and shared canvas across scenes', async ({ page, context }) => {
  await page.goto('/');
  const canvas = await page.locator('canvas').elementHandle();
  await page.getByLabel('Passwort', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Öffnen', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Falsches Passwort.');
  await page.getByLabel('Passwort', { exact: true }).fill('particle-test');
  await page.getByRole('button', { name: 'Öffnen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Was möchtest du sagen?' })).toBeVisible();
  expect(await canvas?.evaluate(el => el === document.querySelector('canvas'))).toBe(true);
  const cookie = (await context.cookies()).find(c => c.name === 'particle_message_access');
  expect(cookie?.httpOnly).toBe(true); expect(cookie?.sameSite).toBe('Strict'); expect(cookie?.secure).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain('particle_message_access');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Nachricht erstellen' })).toBeVisible();
  await expect(page.getByLabel('Passwort', { exact: true })).toHaveCount(0);
});
test('per-slide writing, emoji insertion at cursor, ordering, preview, save and copy', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await unlock(page);
  const input = page.getByRole('textbox', { name: 'ABSCHNITT 01' });
  await input.fill('Hallo Welt'); for (let i = 0; i < 10; i++) await input.press('ArrowLeft');
  await page.getByRole('button', { name: '☺ Emoji', exact: true }).click();
  await page.getByRole('button', { name: '❤️ einfügen', exact: true }).click();
  await expect(input).toHaveValue('❤️Hallo Welt');
  await page.getByRole('switch', { name: 'Schreibanimation' }).check();
  await select(page, 'Schreibrhythmus', 'Ruhig');
  await page.getByText('Timing verfeinern +', { exact: true }).click();
  await page.getByLabel('Fragezeichen ?', { exact: true }).fill('1000');
  await select(page, 'Animation dieses Abschnitts', 'Welle');
  await page.getByRole('button', { name: 'Abschnitt hinzufügen', exact: true }).click();
  await page.getByRole('textbox', { name: 'ABSCHNITT 02' }).fill('Du bist wunderbar. ✨');
  await expect(page.getByRole('switch', { name: 'Schreibanimation' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Abschnitt nach vorne' }).click();
  await expect(input).toHaveValue('Du bist wunderbar. ✨');
  const canvas = await page.locator('canvas').elementHandle();
  await page.getByRole('button', { name: 'Vorschau', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Vorschau', exact: true })).toBeVisible();
  expect(await canvas?.evaluate(el => el === document.querySelector('canvas'))).toBe(true);
  await page.getByRole('button', { name: 'Vorschau beenden' }).click();
  await expect(input).toBeVisible();
  let saved: Record<string, unknown> | undefined;
  await page.route('**/rest/v1/messages*', async route => { saved = route.request().postDataJSON(); await route.fulfill({ status: 201, body: '' }); });
  await page.getByRole('button', { name: 'Nachricht senden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deine Nachricht ist unterwegs.' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Link zu deiner Nachricht' })).toHaveValue(/\/m\/[A-Za-z0-9_-]{12}$/);
  expect(saved?.content).toMatchObject({ slides: [{ text: 'Du bist wunderbar. ✨' }, { effect: 'wave', writing: { enabled: true, speed: 115, questionPause: 1000 } }] });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Link kopieren', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Kopiert ✓' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('public links play without password, with readable responsive text', async ({ page }, testInfo) => {
  await mockMessage(page); await page.goto('/p/publicTest12');
  await expect(page.getByRole('region', { name: 'Nachricht', exact: true })).toBeVisible();
  await expect(page.getByLabel('Passwort', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Nachrichteneditor')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveAttribute('data-phase', 'holding');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/public-${testInfo.project.name}.png` });
});
test('missing, expired and offline messages have line error scenes', async ({ page }) => {
  await mockMessage(page, new Date(Date.now() - 73 * 3600000).toISOString()); await page.goto('/p/expired12345');
  await expect(page.getByRole('heading', { name: 'Dieser Link ist abgelaufen.' })).toBeVisible();
  await page.route('**/rest/v1/messages*', route => route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116' }) }));
  await page.reload(); await expect(page.getByRole('heading', { name: 'Diese Nachricht existiert nicht.' })).toBeVisible();
  await page.route('**/rest/v1/messages*', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.reload(); await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible({ timeout: 20000 });
});
test('live preview uses writing without turning the interface into particles', async ({ page }, testInfo) => {
  await unlock(page);
  await page.getByRole('textbox', { name: 'ABSCHNITT 01' }).fill('Hi. A❤️');
  await page.getByRole('switch', { name: 'Schreibanimation' }).check();
  await select(page, 'Schreibrhythmus', 'Dramatisch');
  await page.getByLabel('Live-Vorschau').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Abschnitt erneut abspielen' }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-visible-characters', '3');
  await expect(page.locator('canvas')).toHaveAttribute('data-visible-characters', '6');
  await expect(page.locator('canvas')).toHaveAttribute('data-phase', 'holding');
  expect(await page.locator('canvas').count()).toBe(1);
  await expect(page.locator('canvas')).toHaveAttribute('data-renderer', 'webgl2');
  expect(Number(await page.locator('canvas').getAttribute('data-line-point-count'))).toBeLessThan(12000);
  expect(Number(await page.locator('canvas').getAttribute('data-ui-target-count'))).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/editor-${testInfo.project.name}.png` });
  await page.waitForTimeout(3500);
  await expect(page.locator('canvas')).toHaveAttribute('data-phase', 'holding');
});
test('missing canvas provides a functional readable fallback', async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await unlock(page); await page.getByRole('textbox', { name: 'ABSCHNITT 01' }).fill('Hallo ohne Canvas ❤️');
  await page.getByRole('button', { name: 'Vorschau', exact: true }).click();
  await expect(page.locator('.viewer-text')).toHaveText('Hallo ohne Canvas ❤️');
  await expect(page.locator('.viewer-text')).not.toHaveCSS('color', 'rgba(0, 0, 0, 0)');
});
test('reduced motion, public replay and automatic editor return', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockMessage(page, new Date().toISOString(), { version: 1, slides: [{ text: 'Hallo ❤️', duration: 1000 }] });
  await page.goto('/p/reducedTest1');
  await expect(page.getByRole('button', { name: 'Nochmal' })).toBeVisible();
  await page.getByRole('button', { name: 'Nochmal' }).click();
  await expect(page.getByRole('region', { name: 'Nachricht', exact: true })).toBeVisible();
  await unlock(page); await page.getByRole('textbox', { name: 'ABSCHNITT 01' }).fill('Bis gleich.');
  await select(page, 'Dauer des fertigen Textes', '1 Sekunden');
  await page.getByRole('button', { name: 'Vorschau', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Vorschau', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'ABSCHNITT 01' })).toBeVisible({ timeout: 8000 });
});
test('writing retains punctuation pause and graphemes across resize', async ({ page }) => {
  await mockMessage(page, new Date().toISOString(), { version: 1, slides: [{ text: 'Hi. A❤️', duration: 3000, writing: { enabled: true, speed: 100, punctuationPause: 1800, paragraphPause: 1500 } }] });
  await page.goto('/p/writingTest1'); await expect(page.locator('canvas')).toHaveAttribute('data-visible-characters', '3');
  await page.setViewportSize({ width: 600, height: 850 });
  await expect(page.locator('canvas')).toHaveAttribute('data-visible-characters', '3');
  await expect(page.locator('canvas')).toHaveAttribute('data-visible-characters', '6');
  await expect(page.locator('canvas')).toHaveAttribute('data-phase', 'holding');
});
test('all transitions play and finish without canvas resets', async ({ page }) => {
  test.setTimeout(70000);
  const effects = ['morph', 'scatter', 'wave', 'vortex', 'rain', 'implode', 'fade', 'rise', 'bloom', 'typewriter', 'random'];
  await mockMessage(page, new Date().toISOString(), { version: 1, slides: effects.map(effect => ({ text: effect, effect, duration: 1000 })) });
  await page.goto('/p/allEffects12');
  const canvas = await page.locator('canvas').elementHandle();
  for (const effect of effects) await expect(page.locator('.viewer-text')).toHaveText(effect, { timeout: 9000 });
  await expect(page.getByRole('button', { name: 'Nochmal' })).toBeVisible({ timeout: 9000 });
  expect(await canvas?.evaluate(el => el === document.querySelector('canvas'))).toBe(true);
});
test('limits, deletion, validation, and save errors retain the draft', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await unlock(page);
  await page.getByRole('button', { name: 'Nachricht senden', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Abschnitt 1 ist noch leer.');
  const input = page.getByRole('textbox', { name: 'ABSCHNITT 01' });
  await input.fill('A'.repeat(151)); await expect(input).toHaveValue('A'.repeat(150));
  for (let i = 1; i < 15; i++) await page.getByRole('button', { name: 'Abschnitt hinzufügen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abschnitt hinzufügen', exact: true })).toBeDisabled();
  for (let i = 1; i < 15; i++) await page.getByRole('button', { name: 'Abschnitt löschen', exact: true }).click();
  await page.route('**/rest/v1/messages*', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501' }) }));
  await page.getByRole('button', { name: 'Nachricht senden', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('nicht gespeichert'); await expect(input).toHaveValue('A'.repeat(150));
});

test('an open public message stops at its absolute expiry', async ({ page }) => {
  await mockMessage(page, new Date(Date.now() - 72 * 3600000 + 5000).toISOString());
  await page.goto('/p/deadlineTest');
  await expect(page.getByRole('region', { name: 'Nachricht', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dieser Link ist abgelaufen.' })).toBeVisible({ timeout: 7000 });
  await expect(page.getByRole('button', { name: 'Nochmal' })).toHaveCount(0);
});

test('150-character message wraps legibly within desktop and mobile canvas', async ({ page }, testInfo) => {
  const text = 'Manchmal braucht es nur ein paar Worte. Danke, dass du immer für mich da bist. Du machst meine Welt ein bisschen heller. Schön, dass es dich gibt. ❤️';
  await mockMessage(page, new Date().toISOString(), { version: 1, slides: [{ text, duration: 10000 }] });
  await page.goto('/p/longText1234');
  await expect(page.locator('.viewer-text')).toHaveText(text);
  await expect(page.locator('canvas')).toHaveAttribute('data-phase', 'holding');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const bounds = JSON.parse((await page.locator('canvas').getAttribute('data-text-bounds'))!);
  const viewport = page.viewportSize()!;
  expect(bounds.left).toBeGreaterThan(0); expect(bounds.right).toBeLessThan(viewport.width);
  expect(bounds.top).toBeGreaterThan(0); expect(bounds.bottom).toBeLessThan(viewport.height - 60);
  await page.screenshot({ path: `test-results/long-text-${testInfo.project.name}.png` });
});


test('custom selects support keyboard navigation, escape, typeahead and outside dismissal', async ({ page }) => {
  await unlock(page);
  const combo = page.getByRole('combobox', { name: 'Animation dieses Abschnitts' });
  await combo.focus(); await combo.press('Enter');
  await expect(page.getByRole('option', { name: 'Formwechsel' })).toHaveAttribute('aria-selected', 'true');
  await combo.press('ArrowDown'); await combo.press('Enter');
  await expect(combo).toHaveText('Verstreut');
  await combo.press('Enter'); await combo.press('End'); await combo.press('Escape');
  await expect(combo).toHaveText('Verstreut'); await expect(combo).toBeFocused();
  await combo.press('w'); await combo.press('e'); await combo.press('Enter');
  await expect(combo).toHaveText('Welle');
  await combo.click(); await page.getByRole('textbox', { name: 'ABSCHNITT 01' }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await combo.click(); await combo.press('Tab'); await expect(combo).not.toBeFocused();
  await expect(page.locator('select')).toHaveCount(0);
});

test('edit debounce, long text and scene departure retain the editor during line retraction', async ({ page }, testInfo) => {
  await unlock(page);
  const input = page.getByRole('textbox', { name: 'ABSCHNITT 01' });
  await input.fill('Ein ruhiger Anfang.');
  await expect.poll(async () => Number(await page.locator('canvas').getAttribute('data-text-target-count'))).toBeGreaterThan(50);
  const previous = await page.locator('canvas').getAttribute('data-text-target-count');
  await input.fill('W'.repeat(150));
  expect(await page.locator('canvas').getAttribute('data-text-target-count')).toBe(previous);
  await expect.poll(async () => page.locator('canvas').getAttribute('data-text-target-count')).not.toBe(previous);
  await expect(page.locator('canvas')).toHaveAttribute('data-phase', 'holding');
  expect(Number(await page.locator('canvas').getAttribute('data-text-font-size'))).toBeGreaterThanOrEqual(16);
  await page.getByLabel('Live-Vorschau').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/unbroken-${testInfo.project.name}.png` });
  await page.getByRole('button', { name: 'Vorschau', exact: true }).click();
  await expect(page.locator('main')).toHaveClass(/transitioning/);
  await expect(page.getByLabel('Nachrichteneditor')).toBeAttached();
  expect(await page.getByLabel('Nachrichteneditor').evaluate(el => getComputedStyle(el).visibility)).toBe('visible');
  await expect(page.getByRole('region', { name: 'Vorschau', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Vorschau beenden' }).click();
  await expect(input).toHaveValue('W'.repeat(150));
});
