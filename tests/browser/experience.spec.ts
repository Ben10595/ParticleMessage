import { test, expect, type Page } from '@playwright/test';

async function unlock(page: Page) {
  await page.goto('/');
  await page.getByLabel('Passwort', { exact: true }).fill('particle-test');
  await page.getByRole('button', { name: 'Öffnen' }).click();
  await page.getByRole('button', { name: 'Nachricht schreiben' }).click();
  await expect(page.getByRole('textbox', { name: 'ABSCHNITT 01' })).toBeVisible();
}
const content = { version: 1, slides: [{ text: 'Schön, dass es dich gibt. ❤️', duration: 4000 }, { text: 'Du machst den Unterschied. ✨', duration: 1000 }] };
async function mockMessage(page: Page, createdAt = new Date().toISOString(), message = content) {
  await page.route('**/rest/v1/messages*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: message, created_at: createdAt }) }));
}

test('password, editor, emoji insertion, settings, reorder, preview and save', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await unlock(page);
  await page.getByRole('textbox', { name: 'ABSCHNITT 01' }).fill('Schön, dass es dich gibt.');
  await page.getByRole('button', { name: '☺ Emoji' }).click();
  await page.getByRole('button', { name: '❤️ einfügen', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'ABSCHNITT 01' })).toHaveValue('Schön, dass es dich gibt.❤️');
  await page.getByRole('switch', { name: 'Wie geschrieben' }).check();
  await page.getByLabel('Schreibrhythmus').selectOption('Ruhig');
  await page.getByText('Feinabstimmung', { exact: false }).click();
  await page.getByRole('switch', { name: 'Ein besonderes Finale' }).check();
  await page.getByLabel('Übergang dieses Abschnitts').selectOption('wave');
  await page.getByRole('button', { name: 'Neue Nachricht hinzufügen' }).click();
  await page.getByRole('textbox', { name: 'ABSCHNITT 02' }).fill('Du bist wunderbar. ✨');
  await page.getByRole('button', { name: 'Abschnitt nach vorne' }).click();
  await expect(page.getByRole('textbox', { name: 'ABSCHNITT 01' })).toHaveValue('Du bist wunderbar. ✨');
  await page.getByRole('button', { name: 'Gesamtvorschau' }).click();
  await expect(page.getByRole('region', { name: 'Vorschau', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Vorschau beenden' }).click();
  await expect(page.getByRole('textbox', { name: 'ABSCHNITT 01' })).toBeVisible();
  let saved: Record<string, unknown> | undefined;
  await page.route('**/rest/v1/messages*', async route => {
    saved = route.request().postDataJSON();
    await route.fulfill({ status: 201, body: '' });
  });
  await page.getByRole('button', { name: 'Link erstellen' }).click();
  await expect(page.getByRole('textbox', { name: 'Link zu deiner Nachricht' })).toHaveValue(/\/p\/[A-Za-z0-9_-]{12}$/);
  expect(saved?.content).toMatchObject({ settings: { finale: true, writing: { enabled: true, speed: 115 } }, slides: [{ text: 'Du bist wunderbar. ✨' }, { effect: 'wave' }] });
  expect(errors).toEqual([]);
});

test('public links autoplay without password and remain readable on every viewport', async ({ page }, testInfo) => {
  await mockMessage(page);
  await page.goto('/p/publicTest12');
  await expect(page.getByRole('region', { name: 'Nachricht', exact: true })).toBeVisible();
  await expect(page.getByLabel('Passwort', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Nachrichteneditor')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveAttribute('data-phase', 'holding');
  await expect(page.getByText('Created with')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/public-${testInfo.project.name}.png` });
});

test('expired and removed messages do not play; connectivity errors offer retry', async ({ page }) => {
  await mockMessage(page, new Date(Date.now() - 73 * 3600000).toISOString());
  await page.goto('/p/expired12345');
  await expect(page.getByRole('heading', { name: 'Dieser Link ist abgelaufen.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Nachricht', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toHaveCount(0);
  await page.route('**/rest/v1/messages*', route => route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116' }) }));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dieser Link ist abgelaufen.' })).toBeVisible();
  await page.route('**/rest/v1/messages*', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible({ timeout: 20000 });
});

test('live preview settles, keeps normal UI readable, and has no horizontal overflow', async ({ page }, testInfo) => {
  await unlock(page);
  await page.getByRole('textbox', { name: 'ABSCHNITT 01' }).fill('Schön, dass es\ndich gibt. ❤️');
  await expect(page.locator('canvas')).toHaveAttribute('data-phase', 'holding');
  await expect(page.getByRole('textbox', { name: 'ABSCHNITT 01' })).not.toHaveCSS('color', 'rgba(0, 0, 0, 0)');
  await page.getByLabel('Live-Vorschau').scrollIntoViewIfNeeded();
  await expect(page.locator('canvas')).toHaveAttribute('data-phase', 'holding');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/editor-${testInfo.project.name}.png`, fullPage: true });
});

test('missing canvas has a readable functional fallback', async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await unlock(page);
  await page.getByRole('textbox', { name: 'ABSCHNITT 01' }).fill('Hallo ohne Canvas ❤️');
  await page.getByRole('button', { name: 'Gesamtvorschau' }).click();
  await expect(page.locator('.viewer-text')).toHaveText('Hallo ohne Canvas ❤️');
  await expect(page.locator('.viewer-text')).not.toHaveCSS('color', 'rgba(0, 0, 0, 0)');
});

test('writing is optional, motion preference is respected, and replay works', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const message = { ...content, settings: { effect: 'morph', finale: false, writing: { enabled: true, speed: 250, punctuationPause: 2500, paragraphPause: 4000 } }, slides: [{ text: 'Hallo ❤️', duration: 1000 }] };
  await mockMessage(page, new Date().toISOString(), message);
  await page.goto('/p/reducedTest1');
  await expect(page.locator('canvas')).toHaveAttribute('data-phase', 'holding');
  await expect(page.getByRole('button', { name: 'Nochmal' })).toBeVisible();
  await page.getByRole('button', { name: 'Nochmal' }).click();
  await expect(page.getByRole('region', { name: 'Nachricht', exact: true })).toBeVisible();
});

test('an already open public link stops at its absolute expiry', async ({ page }) => {
  await mockMessage(page, new Date(Date.now() - 72 * 3600000 + 4500).toISOString());
  await page.goto('/p/deadlineTest');
  await expect(page.getByRole('region', { name: 'Nachricht', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dieser Link ist abgelaufen.' })).toBeVisible({ timeout: 7000 });
  await expect(page.getByRole('button', { name: 'Nochmal' })).toHaveCount(0);
});

test('typing pauses at punctuation and preserves progress on resize', async ({ page }) => {
  const message = { ...content, settings: { effect: 'morph', finale: false, writing: { enabled: true, speed: 100, punctuationPause: 1300, paragraphPause: 1500 } }, slides: [{ text: 'Hi. A❤️', duration: 3000 }] };
  await mockMessage(page, new Date().toISOString(), message);
  await page.goto('/p/writingTest1');
  await expect(page.locator('canvas')).toHaveAttribute('data-visible-characters', '3');
  await page.setViewportSize({ width: 600, height: 850 });
  await expect(page.locator('canvas')).toHaveAttribute('data-visible-characters', '3');
  await expect(page.locator('canvas')).toHaveAttribute('data-visible-characters', '6');
  await expect(page.locator('canvas')).toHaveAttribute('data-phase', 'holding');
});
