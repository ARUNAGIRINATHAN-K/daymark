import { expect, test } from '@playwright/test';

test('serves the installable shell and principal routes at the target viewport', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Daymark/);

  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifest).toBeTruthy();
  const manifestResponse = await page.request.get(manifest!);
  expect(manifestResponse.ok()).toBeTruthy();
  const manifestData = await manifestResponse.json() as {
    name: string;
    display: string;
    start_url: string;
    icons: Array<{ src: string; sizes: string }>;
  };
  expect(manifestData.name).toBe('Daymark');
  expect(manifestData.display).toBe('standalone');
  expect(manifestData.start_url).toBe('/');
  expect(manifestData.icons.some((icon) => icon.sizes === '192x192')).toBe(true);
  expect(manifestData.icons.some((icon) => icon.sizes === '512x512')).toBe(true);
  for (const icon of manifestData.icons) {
    expect((await page.request.get(icon.src)).ok()).toBeTruthy();
  }

  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Service workers are unavailable.');
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  const workerAndCache = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const assetUrls = Array.from(document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src], link[rel="stylesheet"]'))
      .map((element) => element instanceof HTMLScriptElement ? element.src : element.href);
    const cacheNames = await caches.keys();
    const cachedAssets = await Promise.all(assetUrls.map(async (url) => {
      const response = await caches.match(url);
      return Boolean(response);
    }));
    return {
      activeWorker: Boolean(registration?.active),
      controlled: Boolean(navigator.serviceWorker.controller),
      cacheNames,
      cachedAssetCount: cachedAssets.filter(Boolean).length,
      appAssetCount: assetUrls.length,
    };
  });
  expect(workerAndCache.activeWorker).toBe(true);
  expect(workerAndCache.controlled).toBe(true);
  expect(workerAndCache.cacheNames.length).toBeGreaterThan(0);
  expect(workerAndCache.cachedAssetCount).toBeGreaterThan(0);
  expect(workerAndCache.appAssetCount).toBeGreaterThan(0);

  for (const [route, heading] of [
    ['/notes', 'All Notes'],
    ['/tasks', 'All Tasks'],
    ['/folders', 'Folders'],
    ['/archive', 'Archive'],
    ['/trash', 'Trash'],
    ['/search', 'Search'],
    ['/settings', 'Application Settings'],
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
  }

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test('creates a task locally and retains it through an offline production-shell relaunch', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return;
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'New Task' }).click();
  await page.getByPlaceholder('e.g. Audit IndexedDB storage & transactions').fill('Offline audit task');
  await page.getByRole('button', { name: 'Create Task' }).click();
  await expect(page.getByText('Offline audit task')).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'All Tasks' })).toBeVisible();
  await expect(page.getByText('Offline audit task')).toBeVisible();
});

test('creates and saves a note in IndexedDB for offline reload', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return;
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New Note' }).click();
  await page.getByPlaceholder('Untitled Note').fill('Offline audit note');
  await expect(page.getByText('✓ Saved locally')).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByPlaceholder('Untitled Note')).toHaveValue('Offline audit note');
});
