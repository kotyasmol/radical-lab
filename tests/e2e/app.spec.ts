import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
async function calculate(page: import('@playwright/test').Page, expression: string) {
  await page.locator('#expression').fill(expression);
  await page.getByRole('button', { name: 'Вычислить', exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});
test('numeric workflow, precision and history', async ({ page }) => {
  await calculate(page, 'sqrt(-16)+sqrt(2)');
  await expect(page.getByTestId('result')).toHaveText('1.4142135623730950488 + 4i');
  await page.locator('#display').fill('5');
  await expect(page.getByTestId('result')).toHaveText('1.4142 + 4i');
  await page.locator('#notation').selectOption('scientific');
  await expect(page.getByTestId('result')).toHaveText('1.4142e+0 + 4.0000e+0i');
  await expect(page.locator('.history-list li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Очистить', exact: true }).click();
  await expect(page.locator('.history-list li')).toHaveCount(0);
});
test('symbolic fractions, radicals, variables', async ({ page }) => {
  await page.getByRole('button', { name: 'Символьно', exact: true }).click();
  await calculate(page, 'sqrt(8)');
  await expect(page.getByTestId('result')).toHaveText('2*sqrt(2)');
  await calculate(page, 'x+x');
  await expect(page.getByTestId('result')).toHaveText('2*x');
  await calculate(page, '1/3');
  await expect(page.getByTestId('result')).toHaveText('1/3');
  await expect(page.locator('#working')).toBeDisabled();
});
test('invalid input recovers and never executes code', async ({ page }) => {
  await calculate(page, '1/0');
  await expect(page.getByRole('alert')).toContainText('Деление на ноль');
  await calculate(page, '<script>alert(1)</script>');
  await expect(page.getByRole('alert')).toContainText('Проверьте');
  await calculate(page, 'sqrt(0,25)');
  await expect(page.getByTestId('result')).toHaveText('0.5');
  await page.locator('#expression').fill('9');
  await expect(page.getByTestId('result')).toHaveCount(0);
  await page.locator('#expression').press('Enter');
  await expect(page.getByTestId('result')).toHaveText('9');
});
test('every language, translated errors, help and session removal', async ({ page }) => {
  for (const [locale, label, error] of [
    ['en', 'Calculate', 'Division by zero'],
    ['es', 'Calcular', 'dividir entre cero'],
    ['zh', '计算', '除数不能为零'],
    ['ru', 'Вычислить', 'Деление на ноль'],
  ]) {
    await page.locator('.language-select').selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await page.locator('#expression').fill('1/0');
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(error);
  }
  await calculate(page, 'sqrt(-1)');
  await page.getByRole('button', { name: 'Справка', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Завершить сеанс', exact: true }).click();
  await page.getByRole('button', { name: 'Очистить сеанс', exact: true }).click();
  await expect(page.locator('#expression')).toHaveValue('');
  await expect(page.locator('.history-list li')).toHaveCount(0);
  await expect(page.getByTestId('result')).toHaveCount(0);
});
test('no persistence and no outgoing calculation requests', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:4173'))
      external.push(r.url());
  });
  await calculate(page, '(2+3i)^2');
  await expect(page.getByTestId('result')).toHaveText('-5 + 12i');
  expect(external).toEqual([]);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookies: document.cookie,
    })),
  ).toEqual({ local: 0, session: 0, cookies: '' });
  await page.reload();
  await expect(page.locator('.history-list li')).toHaveCount(0);
});
test('export is a real JSON download', async ({ page }) => {
  await calculate(page, 'sqrt(4)');
  await expect(page.getByTestId('result')).toHaveText('2');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('radical-lab-history.json');
});
test('update checks handle available version and network failure', async ({ page }) => {
  await page.route('https://api.github.com/repos/kotyasmol/radical-lab/releases/latest', (route) =>
    route.fulfill({ json: { tag_name: 'v1.0.1' } }),
  );
  await page.getByRole('button', { name: 'Обновления', exact: true }).click();
  await page.getByRole('button', { name: 'Проверить обновления', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('v1.0.1');
  await page.route('https://api.github.com/repos/kotyasmol/radical-lab/releases/latest', (route) =>
    route.abort(),
  );
  await page.getByRole('button', { name: 'Проверить обновления', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Не удалось проверить');
});
test('responsive layout and basic WCAG audit', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await calculate(page, 'sqrt(-16) + sqrt(2)');
  await expect(page.getByTestId('result')).toHaveText('1.4142135623730950488 + 4i');
  if (testInfo.project.name === 'chromium' && !process.env.CI)
    await page.screenshot({ path: 'docs/screenshots/desktop.png', fullPage: true });
  await calculate(page, 'sqrt(-1)');
  await expect(page.getByTestId('result')).toHaveText('i');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.language-select').selectOption('es');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (testInfo.project.name === 'chromium' && !process.env.CI)
    await page.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: true });
});
test('portable HTML works offline through file://', async ({ page, context, browserName }) => {
  // WebKit's network-offline emulator also rejects file navigation. Block all
  // HTTP(S) instead there; no external resources can load in either approach.
  if (browserName !== 'webkit') await context.setOffline(true);
  await context.route(/^https?:/, (route) => route.abort('internetdisconnected'));
  await page.goto(pathToFileURL(resolve('dist/radical-lab.html')).href);
  await calculate(page, 'sqrt(-9)');
  await expect(page.getByTestId('result')).toHaveText('3i');
  await page.getByRole('button', { name: 'Символьно', exact: true }).click();
  await calculate(page, 'sqrt(8)');
  await expect(page.getByTestId('result')).toHaveText('2*sqrt(2)');
});
for (const action of ['cancel', 'timeout'])
  test(`worker ${action} and recovery (fault injection)`, async ({ page }) => {
    await page.addInitScript(() => {
      const RealWorker = window.Worker;
      let first = true;
      window.Worker = new Proxy(RealWorker, {
        construct(Target, args) {
          const worker = new Target(args[0], args[1]);
          if (first) {
            first = false;
            worker.postMessage = () => {};
          }
          return worker;
        },
      });
    });
    await page.reload();
    await calculate(page, 'sqrt(4)');
    if (action === 'cancel')
      await page.getByRole('button', { name: 'Отмена', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(
      action === 'cancel' ? 'отменено' : 'больше четырёх секунд',
      { timeout: 10000 },
    );
    await calculate(page, 'sqrt(4)');
    await expect(page.getByTestId('result')).toHaveText('2');
  });
