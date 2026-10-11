import { expect, test } from '@playwright/test';

/**
 * Runs against the production build (`vite preview`): after one visit the
 * app, including the piano samples, must work with the network gone.
 */
test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByTestId('piano-key-C4')).toBeVisible();
  await expect(page.getByTestId('sample-status')).toHaveText('Piano samples ready', {
    timeout: 20000,
  });

  // wait for the service worker to take control and finish caching
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, {
    timeout: 15000,
  });
  await page.waitForTimeout(6000);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('piano-key-C4')).toBeVisible();
  await expect(page.getByTestId('sample-status')).toHaveText('Piano samples ready', {
    timeout: 20000,
  });

  await page.keyboard.down('KeyA');
  await expect(page.getByTestId('piano-key-C4')).toHaveAttribute('data-active', 'true');
  await page.keyboard.up('KeyA');
  await context.setOffline(false);
});
