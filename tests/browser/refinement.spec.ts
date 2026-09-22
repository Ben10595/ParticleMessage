import { test, expect, type Page } from '@playwright/test';
async function home(page: Page) {
  await page.goto('/');
  await page.getByLabel('Passwort', { exact: true }).fill('particle-test');
  await page.getByRole('button', { name: 'Öffnen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Was möchtest du sagen?' })).toBeVisible();
}
test('page text cannot be selected or copied, while editing and secret selections work', async ({ page }) => {
  await home(page);
  const heading = page.getByRole('heading', { name: 'Was möchtest du sagen?' });
  expect(await heading.evaluate(el => getComputedStyle(el).userSelect)).toBe('none');
  const box = (await heading.boundingBox())!;
  await page.mouse.move(box.x + 3, box.y + box.height / 3); await page.mouse.down();
  await page.mouse.move(box.x + box.width - 3, box.y + box.height * .8, { steps: 10 }); await page.mouse.up();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('');
  expect(await heading.evaluate(el => !el.dispatchEvent(new Event('copy', { bubbles: true, cancelable: true })))).toBe(true);
  await page.getByRole('button', { name: 'Nachricht erstellen', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'ABSCHNITT 01' });
  await input.fill('Hallo Welt.'); await input.press('ControlOrMeta+A');
  expect(await input.evaluate((el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart)).toBe(11);
  expect(await input.evaluate(el => getComputedStyle(el).userSelect)).toBe('text');
  expect(await input.evaluate(el => el.dispatchEvent(new Event('copy', { bubbles: true, cancelable: true })))).toBe(true);
  await page.getByRole('button', { name: 'Auswahl geheim' }).click();
  await expect(page.getByLabel('Zusatznachricht 1')).toBeVisible();
});
test('scroll preserves particle assignments and the desktop stage stays fixed', async ({ page }, info) => {
  await home(page); await page.getByRole('button', { name: 'Nachricht erstellen', exact: true }).click();
  await page.getByRole('textbox', { name: 'ABSCHNITT 01' }).fill('Deine Worte bleiben.');
  for (const title of ['Bewegung & Atmosphäre', 'Diesen Abschnitt besonders machen', 'Für die ganze Nachricht']) {
    await page.locator('summary').filter({ hasText: title }).click();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(0, 0);
  const canvas = page.locator('canvas'), preview = page.getByLabel('Live-Vorschau');
  await expect(canvas).toHaveAttribute('data-phase', 'holding');
  await page.waitForTimeout(900);
  const original = { ui: await canvas.getAttribute('data-ui-revision'), text: await canvas.getAttribute('data-text-revision'), box: await preview.boundingBox() };
  for (const y of [160, 400, 650]) { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(150); }
  expect(await canvas.getAttribute('data-ui-revision')).toBe(original.ui);
  expect(await canvas.getAttribute('data-text-revision')).toBe(original.text);
  if (info.project.name === 'desktop') {
    const box = (await preview.boundingBox())!;
    expect(Math.abs(box.y - original.box!.y)).toBeLessThan(1);
    expect(box.y + box.height).toBeLessThan(page.viewportSize()!.height);
    await expect(preview).toBeInViewport();
  }
  await page.waitForTimeout(3500);
  await expect(canvas).toHaveAttribute('data-phase', 'holding');
  expect(await canvas.getAttribute('data-text-revision')).toBe(original.text);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/refined-editor-${info.project.name}.png` });
});

test('the refined editor fits narrow phones, landscape and tablet viewports', async ({ page }, info) => {
  await home(page); await page.getByRole('button', { name: 'Nachricht erstellen', exact: true }).click();
  await page.getByRole('textbox', { name: 'ABSCHNITT 01' }).fill('Ein kleiner Moment.');
  for (const size of [{width:360,height:740},{width:844,height:390},{width:1024,height:768}]) {
    await page.setViewportSize(size);
    await page.evaluate(() => window.scrollTo(0,0));
    await expect(page.locator('canvas')).toHaveAttribute('data-phase','holding');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const stage = (await page.locator('.preview-bounds').boundingBox())!;
    expect(stage.x).toBeGreaterThanOrEqual(0); expect(stage.x + stage.width).toBeLessThanOrEqual(size.width);
    if (size.width > 760) {
      expect(stage.y).toBeGreaterThan(0); expect(stage.y + stage.height).toBeLessThan(size.height);
    }
    await page.waitForTimeout(1100);
    await page.screenshot({path:`test-results/refined-${size.width}-${info.project.name}.png`});
  }
});
