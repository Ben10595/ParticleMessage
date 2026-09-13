import { test, expect, type Page } from '@playwright/test';
import { DEFAULT_SETTINGS, type MessageContent } from '../../types/message';
async function message(page: Page, content: MessageContent) {
  await page.route('**/rest/v1/messages*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content, created_at: new Date().toISOString() }) }));
  await page.goto('/p/featureTest12');
}
async function select(page: Page, label: string, option: string) { await page.getByRole('combobox', { name: label, exact: true }).click(); await page.getByRole('option', { name: option, exact: true }).click(); }
const secret = { start: 0, end: 5, text: 'Du bist mein Lieblingsmensch.', returnAfter: 0 };
test('puzzle, gift, reversible hold, localized secret, finale and replay share one sequence', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await message(page, { version: 1, slides: [{ text: 'Hallo Welt.', duration: 1000, effect: 'spiral', features: { puzzle: { kind: 'choice', question: 'Unser Lieblingsort?', answers: ['Am Meer', 'Im Büro'], correct: 0 }, gift: 'ribbon', hold: true, secrets: [secret] } }], settings: { ...DEFAULT_SETTINGS, finale: true, finaleConfig: { shape: 'heart', ending: 'float', duration: 2000 } } });
  const canvas = page.locator('canvas'), held = page.getByRole('button', { name: 'Gedrückt halten zum Enthüllen' });
  await page.getByRole('button', { name: '02 Im Büro' }).click();
  await expect(page.getByRole('status')).toContainText('Noch nicht ganz');
  await expect(page.locator('.viewer-text')).not.toHaveText('Hallo Welt.');
  await expect(canvas).toHaveAttribute('data-phase', 'holding');
  await page.screenshot({ path: `test-results/features-puzzle-${info.project.name}.png` });
  await page.getByRole('button', { name: '01 Am Meer' }).click();
  await expect(page.getByRole('button', { name: 'Geschenk öffnen' })).toBeVisible();
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `test-results/features-gift-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Geschenk öffnen' }).click();
  await expect(held).toBeVisible();
  const box = (await held.boundingBox())!; await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await expect.poll(async () => Number(await canvas.getAttribute('data-hold-progress'))).toBeGreaterThan(.25);
  await page.mouse.up(); const partial = Number(await canvas.getAttribute('data-hold-progress'));
  await expect.poll(async () => Number(await canvas.getAttribute('data-hold-progress'))).toBeLessThan(partial - .08);
  await held.focus(); await page.keyboard.down('Space');
  await expect(page.locator('[data-stage="reading"]')).toBeAttached(); await page.keyboard.up('Space');
  await expect(canvas).toHaveAttribute('data-hold-progress', '1.000');
  await page.getByRole('button', { name: 'Geheimnis in „Hallo“ öffnen' }).click();
  await expect(page.locator('[data-stage="secret"]')).toBeAttached();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `test-results/features-secret-${info.project.name}.png` });
  await page.setViewportSize({ width: info.project.name === 'mobile' ? 420 : 1280, height: 850 });
  await expect(page.getByRole('button', { name: 'Zur Nachricht zurück' })).toBeVisible();
  await page.getByRole('button', { name: 'Zur Nachricht zurück' }).click();
  await expect(page.locator('[data-stage="reading"]')).toBeAttached();
  await page.getByRole('button', { name: 'Weiter →' }).click();
  await expect(page.getByRole('button', { name: 'Nochmal' })).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `test-results/features-finale-${info.project.name}.png` });
  expect(Number(await canvas.getAttribute('data-text-target-count'))).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Nochmal' }).click();
  await expect(page.getByRole('button', { name: '01 Am Meer' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('editor saves all optional settings, selections survive edits and preview cancels a gate', async ({ page }, info) => {
  await page.goto('/'); await page.getByLabel('Passwort', { exact: true }).fill('particle-test'); await page.getByRole('button', { name: 'Öffnen', exact: true }).click(); await page.getByRole('button', { name: 'Nachricht erstellen' }).click();
  const input = page.getByRole('textbox', { name: 'ABSCHNITT 01' }); await input.fill('Hallo Welt.');
  await input.evaluate((el: HTMLTextAreaElement) => { el.focus(); el.setSelectionRange(0, 5); el.dispatchEvent(new Event('select', { bubbles: true })); });
  await page.getByRole('button', { name: 'Auswahl geheim' }).click();
  await page.getByLabel('Zusatznachricht 1').fill('Eine Überraschung.');
  await page.getByText('Diesen Abschnitt besonders machen', { exact: false }).click();
  await page.getByRole('switch', { name: 'Hold-to-Reveal' }).check();
  await select(page, 'Geschenkanimation', 'Sternenstaub');
  await page.getByRole('switch', { name: 'Rätsel aktivieren' }).check();
  await select(page, 'Rätselart', 'Zahlencode');
  await page.getByLabel('Deine Rätselfrage').fill('Unser Code?'); await page.getByLabel('Richtiger Zahlencode').fill('007');
  await page.getByText('Für die ganze Nachricht', { exact: false }).click();
  await page.getByRole('switch', { name: 'Abschlussanimation' }).check(); await select(page, 'Abschlussform', 'Eigener Text'); await page.getByLabel('Abschlusstext').fill('Für immer.');
  await page.getByRole('switch', { name: 'Neigung als Standard' }).check();
  await page.getByLabel('Live-Vorschau').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Abschnitt erneut abspielen' }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-phase', 'holding');
  await page.screenshot({ path: `test-results/features-editor-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Vorschau', exact: true }).click();
  await expect(page.getByLabel('Dein Zahlencode')).toBeVisible();
  await page.getByRole('button', { name: 'Vorschau beenden' }).click();
  await expect(input).toHaveValue('Hallo Welt.');
  let saved: MessageContent | undefined;
  await page.route('**/rest/v1/messages*', route => { saved = route.request().postDataJSON().content; return route.fulfill({ status: 201, body: '' }); });
  await page.getByRole('button', { name: 'Link erstellen', exact: true }).click();
  await expect(page.getByLabel('Link zu deiner Nachricht')).toBeVisible();
  expect(saved?.slides[0].features).toMatchObject({ hold: true, gift: 'burst', puzzle: { kind: 'code', code: '007' }, secrets: [{ start: 0, end: 5, text: 'Eine Überraschung.' }] });
  expect(saved?.settings).toMatchObject({ tilt: true, finale: true, finaleConfig: { shape: 'text', text: 'Für immer.' } });
});

test('code gate and hold also work without canvas, including leading zeroes', async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext; });
  await message(page, { version: 1, slides: [{ text: 'Lesbar ohne Canvas.', duration: 4000, features: { puzzle: { kind: 'code', question: 'Code?', code: '007' }, hold: true } }] });
  await page.getByLabel('Dein Zahlencode').fill('7'); await page.getByRole('button', { name: 'Nachricht öffnen', exact: true }).click(); await expect(page.locator('.puzzle-feedback')).toContainText('Noch nicht');
  await page.getByLabel('Dein Zahlencode').fill('007'); await page.getByRole('button', { name: 'Nachricht öffnen', exact: true }).click();
  const button = page.getByRole('button', { name: 'Gedrückt halten zum Enthüllen' }); await button.focus(); await page.keyboard.down('Space'); await expect(page.locator('.viewer-text')).toHaveText('Lesbar ohne Canvas.'); await page.keyboard.up('Space');
});

test('reduced motion requires deliberate reveal and secrets return automatically', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await message(page, { version: 1, slides: [{ text: 'Hallo Welt.', duration: 1000, features: { hold: true, secrets: [{ ...secret, returnAfter: 3000 }] } }] });
  await expect(page.locator('[data-stage="hold"]')).toBeAttached();
  await expect(page.locator('canvas')).toHaveAttribute('data-hold-progress', '0.000');
  await page.getByRole('button', { name: 'Gedrückt halten zum Enthüllen' }).press('Space');
  await expect(page.locator('[data-stage="reading"]')).toBeAttached();
  await page.getByRole('button', { name: 'Geheimnis in „Hallo“ öffnen' }).click();
  await expect(page.locator('[data-stage="secret"]')).toBeAttached();
  await expect(page.locator('[data-stage="reading"]')).toBeAttached({ timeout: 6000 });
});

test('device orientation is opt-in and denied permission never blocks reading', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Sensor prompt is restricted to touch devices.');
  await page.addInitScript(() => { Object.defineProperty(DeviceOrientationEvent, 'requestPermission', { value: async () => 'denied', configurable: true }); });
  await message(page, { version: 1, slides: [{ text: 'Hallo Welt.', duration: 10000, features: { tilt: true } }] });
  await page.getByRole('button', { name: 'Neigung aktivieren' }).click();
  await expect(page.getByRole('status')).toContainText('auch ohne Neigung');
  await expect(page.locator('[data-stage="reading"]')).toBeAttached();
});

test('six additional particle reveals finish in the same canvas', async ({ page }) => {
  const effects = ['explosion', 'spiral', 'magnet', 'zoom', 'sweep', 'collect'] as const;
  await message(page, { version: 1, slides: effects.map(effect => ({ text: effect, effect, duration: 1000 })) });
  const canvas = await page.locator('canvas').elementHandle();
  for (const effect of effects) { await expect(page.locator('.viewer-text')).toHaveText(effect, { timeout: 6000 }); await expect(page.locator('canvas')).toHaveAttribute('data-text-effect', effect); }
  await expect(page.getByRole('button', { name: 'Nochmal' })).toBeVisible({ timeout: 6000 });
  expect(await canvas?.evaluate(el => el === document.querySelector('canvas'))).toBe(true);
});

test('text, star and infinity finales support both disappearing endings', async ({ page }) => {
  test.setTimeout(45000);
  for (const [i, shape] of (['text', 'star', 'infinity'] as const).entries()) {
    await message(page, { version: 1, slides: [{ text: 'Für dich.', duration: 1000 }], settings: { ...DEFAULT_SETTINGS, finale: true, finaleConfig: { shape, text: 'Für immer.', ending: i % 2 ? 'fade' : 'explode', duration: 2000 } } });
    await expect(page.locator('[data-stage="finale"]')).toBeAttached({ timeout: 6000 });
    if (shape === 'text') await expect(page.locator('.viewer-text')).toHaveText('Für immer.');
    await expect(page.getByRole('button', { name: 'Nochmal' })).toBeVisible({ timeout: 10000 });
  }
});

test('granted sensor is calibrated, remains subtle and survives scene changes', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Sensor prompt is restricted to touch devices.');
  await page.addInitScript(() => { Object.defineProperty(DeviceOrientationEvent, 'requestPermission', { value: async () => 'granted', configurable: true }); });
  await message(page, { version: 1, slides: [{ text: 'Hallo Welt.', duration: 1000 }, { text: 'Du bleibst.', duration: 10000 }], settings: { ...DEFAULT_SETTINGS, tilt: true } });
  await page.getByRole('button', { name: 'Neigung aktivieren' }).click();
  await page.evaluate(() => { window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: 10, gamma: 0 })); window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: 30, gamma: 20 })); });
  await expect(page.getByRole('status')).toHaveText('Neigung aktiv');
  await expect(page.locator('.viewer-text')).toHaveText('Du bleibst.', { timeout: 7000 });
  await expect(page.getByRole('status')).toHaveText('Neigung aktiv');
  await expect(page.locator('canvas')).toHaveAttribute('data-phase', 'holding');
});
