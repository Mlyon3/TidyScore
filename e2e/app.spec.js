import { expect, test } from '@playwright/test';

test('sample cleanup, undo, and duplicate detection work without console errors', async ({ page }) => {
    const errors = [];
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/TidyScore/');
    await expect(page.getByRole('heading', { name: 'Get your library CSV from forScore' })).toBeVisible();
    await page.getByRole('link', { name: 'Try a sample library' }).click();
    await expect(page.locator('#totalScores')).toHaveText('40');
    await expect(page.getByRole('heading', { name: 'Recommended fixes' })).toBeVisible();

    await page.getByRole('button', { name: 'Fix composers' }).click();
    await expect(page.locator('#extractionModal')).toHaveClass(/active/);
    await page.getByRole('button', { name: 'Apply Selected' }).click();
    await expect(page.locator('#undoBtn')).toBeEnabled();
    await page.locator('#undoBtn').click();

    await page.locator('#advancedTools > summary').click();
    await page.locator('#genreTagMenuTrigger').click();
    await page.getByRole('button', { name: 'Find Duplicates' }).click();
    await expect(page.locator('#duplicateModal')).toHaveClass(/active/);
    await expect(page.locator('#duplicateResults .dup-group')).not.toHaveCount(0);

    expect(errors).toEqual([]);
});

test('export falls back to a download and shows the forScore return steps', async ({ page }) => {
    await page.goto('/TidyScore/');
    await page.getByRole('link', { name: 'Try a sample library' }).click();
    await page.getByRole('button', { name: /Review & Export/ }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save to Files' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^sample-library-tidyscore-\d{4}-\d{2}-\d{2}\.csv$/);
    await expect(page.getByRole('heading', { name: 'Your cleaned CSV is ready' })).toBeVisible();
    await expect(page.locator('#exportCompleteModal')).toContainText('Tools → Backups');
    await expect(page.locator('#exportCompleteModal')).toContainText('scrolled-page icon');
});

test('opt-in recovery restores the current library after reload', async ({ page }) => {
    await page.goto('/TidyScore/');
    await page.getByRole('link', { name: 'Try a sample library' }).click();
    await page.getByLabel('Recover this session on this device').check();
    await expect(page.locator('#deleteSessionBtn')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Continue your previous local session?')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('#totalScores')).toHaveText('40');
});

test('guided workflow fits an iPad portrait viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/TidyScore/');
    await page.getByRole('link', { name: 'Try a sample library' }).click();

    await expect(page.getByRole('heading', { name: 'Recommended fixes' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: /Review & Export/ })).toBeVisible();
});

test('guided workflow fits iPad landscape and Split View widths', async ({ page }) => {
    for (const viewport of [{ width: 1024, height: 768 }, { width: 540, height: 720 }]) {
        await page.setViewportSize(viewport);
        await page.goto('/TidyScore/');
        await page.getByRole('link', { name: 'Try a sample library' }).click();

        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await expect(page.getByRole('button', { name: /Review & Export/ })).toBeVisible();
    }
});
