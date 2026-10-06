import { test, expect } from '@playwright/test';

test.use({ channel: 'msedge' });

test('login-page-smoke', async ({ page }) => {
  await page.route("**/*", async route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin === "http://localhost:5173") {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });
  await page.goto('http://localhost:5173/login');
  await page.getByRole('heading', { name: 'Sign in' }).hover();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
