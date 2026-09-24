import { expect, test, type Page } from '@playwright/test';
import { LIVING_TYPE_ENGINES, type MessageContent } from '../../types/message';

async function openEditor(page: Page) {
  await page.goto('/');
  await page.getByLabel('Passwort', { exact: true }).fill('particle-test');
  await page.getByRole('button', { name: 'Öffnen', exact: true }).click();
  await page.getByRole('button', { name: 'Nachricht erstellen', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'ABSCHNITT 01' })).toBeVisible();
}

test('each section keeps its Living Type engine and controls through preview, saving and shared playback', async ({ page }, info) => {
  test.setTimeout(70000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openEditor(page);

  await page.getByRole('textbox', { name: 'ABSCHNITT 01' }).fill('Hallo ❤️');
  await page.getByRole('button', { name: 'LINE Engine' }).click();
  const lineWidth = page.getByRole('group', { name: 'LINE Einstellungen' }).getByRole('slider', { name: 'Linienstärke' });
  await lineWidth.press('End');
  await expect(lineWidth).toHaveValue('5');
  await page.getByRole('combobox', { name: 'Dauer des fertigen Textes' }).click();
  await page.getByRole('option', { name: '1 Sekunden' }).click();

  const preview = page.getByLabel('Live-Vorschau');
  await expect(preview).toHaveAttribute('data-living-engine', 'line');
  await expect(preview.locator('[data-living-engine="line"]')).toHaveAttribute('data-living-ready', 'true');
  const previewScene = preview.locator('g[data-living-scene="line"]').last();
  await expect(previewScene.locator('[data-role="line-body"]')).toHaveAttribute('d', /M/);
  await page.getByRole('button', { name: 'Abschnitt erneut abspielen' }).click();
  await expect(previewScene).toHaveAttribute('data-phase', 'forming');
  await expect(previewScene).toHaveAttribute('data-phase', 'holding', { timeout: 7000 });
  await expect(previewScene.locator('[data-role="final-text"]')).toHaveAttribute('opacity', '1');
  await preview.screenshot({ path: `test-results/living-line-preview-${info.project.name}.png` });

  await page.getByRole('button', { name: 'Abschnitt hinzufügen', exact: true }).click();
  await page.getByRole('textbox', { name: 'ABSCHNITT 02' }).fill('Ein zweiter Moment. ✨');
  await page.getByRole('button', { name: 'ECHO Engine' }).click();
  const echoControls = page.getByRole('group', { name: 'ECHO Einstellungen' });
  const echoCount = echoControls.getByRole('slider', { name: 'Echo-Anzahl' });
  const echoDistance = echoControls.getByRole('slider', { name: 'Echo-Abstand' });
  await echoCount.press('End');
  await echoDistance.press('End');
  await expect(echoCount).toHaveValue('6');
  await expect(echoDistance).toHaveValue('32');
  await page.getByRole('combobox', { name: 'Dauer des fertigen Textes' }).click();
  await page.getByRole('option', { name: '1 Sekunden' }).click();
  await expect(preview).toHaveAttribute('data-living-engine', 'echo');
  await expect(preview.locator('g[data-living-scene="echo"] [data-role="echo"]')).toHaveCount(6);

  await page.getByRole('button', { name: 'Abschnitt 1', exact: true }).click();
  await expect(lineWidth).toHaveValue('5');
  await expect(preview).toHaveAttribute('data-living-engine', 'line');
  await page.getByRole('button', { name: 'Abschnitt 2', exact: true }).click();
  await expect(echoCount).toHaveValue('6');

  let saved: MessageContent | undefined;
  await page.route('**/rest/v1/messages*', route => {
    if (route.request().method() === 'POST') {
      saved = route.request().postDataJSON().content as MessageContent;
      return route.fulfill({ status: 201, body: '' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: saved, created_at: new Date().toISOString() }) });
  });
  await page.getByRole('button', { name: 'Nachricht senden', exact: true }).click();
  const link = page.getByRole('textbox', { name: 'Link zu deiner Nachricht' });
  await expect(link).toHaveValue(/\/m\/[A-Za-z0-9_-]{12}$/);
  expect(saved?.slides).toMatchObject([
    { text: 'Hallo ❤️', engine: 'line', engineParams: { lineWidth: 5 } },
    { text: 'Ein zweiter Moment. ✨', engine: 'echo', engineParams: { count: 6, distance: 32 } },
  ]);

  await page.goto(await link.inputValue());
  const experience = page.locator('.experience');
  await expect(experience).toHaveAttribute('data-active-engine', 'line', { timeout: 8000 });
  await expect(page.locator('.message-living-stage [data-living-engine="line"]')).toHaveAttribute('data-living-ready', 'true');
  await expect(experience).toHaveAttribute('data-active-engine', 'echo', { timeout: 15000 });
  await expect(page.locator('.message-living-stage')).toHaveAttribute('data-living-transition', 'line');
  await expect(page.locator('.message-living-stage g[data-living-scene="echo"] [data-role="echo"]')).toHaveCount(6);
  await expect(page.getByRole('region', { name: 'Nachricht beendet' })).toBeVisible({ timeout: 15000 });
  expect(errors).toEqual([]);
});

test('reduced motion renders the final Living Type text immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const content: MessageContent = { version: 1, slides: [{ text: 'Ruhiger Moment.', duration: 10000, engine: 'line' }] };
  await page.route('**/rest/v1/messages*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content, created_at: new Date().toISOString() }) }));
  await page.goto('/m/reducedType12');
  await expect(page.locator('.experience')).toHaveAttribute('data-active-engine', 'line');
  const scene = page.locator('.message-living-stage g[data-living-scene="line"]');
  await expect(scene).toHaveAttribute('data-progress', '1.000');
  await expect(scene).toHaveAttribute('data-phase', 'holding');
  await expect(scene.locator('[data-role="final-text"]')).toHaveAttribute('opacity', '1');
});

test('all ten engines complete a readable live reveal without browser errors', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openEditor(page);
  await page.getByRole('textbox', { name: 'ABSCHNITT 01' }).fill('Ein Moment für dich. ✨');
  const preview = page.getByLabel('Live-Vorschau');
  for (const engine of LIVING_TYPE_ENGINES) {
    await page.getByRole('button', { name: `${engine.toUpperCase()} Engine` }).click();
    await expect(preview).toHaveAttribute('data-living-engine', engine);
    const stage = preview.locator(`g[data-living-scene="${engine}"]`).last();
    await expect(stage).toHaveAttribute('data-phase', 'holding', { timeout: 7500 });
    await expect(stage.locator('text').first()).toContainText('Ein Moment');
  }
  expect(errors).toEqual([]);
});
