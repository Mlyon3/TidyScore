import { expect, test } from '@playwright/test';

test('the production PWA cleans legacy caches and performs cleanup offline', async ({ page, context }) => {
    await page.goto('/TidyScore/icons/tidyscore-icon.svg');
    await page.evaluate(async () => {
        await caches.open('tidyscore-shell-v1');
    });

    await page.goto('/TidyScore/');
    await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await expect.poll(() => page.evaluate(async () => !(await caches.keys()).includes('tidyscore-shell-v1'))).toBe(true);

    await context.setOffline(true);
    try {
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Get your library CSV from forScore' })).toBeVisible();
        await page.getByRole('link', { name: 'Try a sample library' }).click();
        await expect(page.locator('#totalScores')).toHaveText('49');
        await page.getByRole('button', { name: 'Fix composers' }).click();
        await expect(page.locator('#extractionModal')).toHaveClass(/active/);
        await page.getByRole('button', { name: 'Apply Selected' }).click();
        await expect(page.locator('#modifiedCount')).not.toHaveText('0');
    } finally {
        await context.setOffline(false);
    }
});
