import { expect, test } from '@playwright/test';

test('sample cleanup, undo, and duplicate detection work without console errors', async ({ page }) => {
    const errors = [];
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.getByRole('link', { name: /try with sample data/i }).click();
    await expect(page.locator('#totalScores')).toHaveText('40');

    await page.getByRole('button', { name: /Smart Extract/i }).click();
    await expect(page.locator('#extractionModal')).toHaveClass(/active/);
    await page.getByRole('button', { name: 'Apply Selected' }).click();
    await expect(page.locator('#undoBtn')).toBeEnabled();
    await page.locator('#undoBtn').click();

    await page.locator('#genreTagMenuTrigger').click();
    await page.getByRole('button', { name: /Find Duplicates/i }).click();
    await expect(page.locator('#duplicateModal')).toHaveClass(/active/);
    await expect(page.locator('#duplicateResults .dup-group')).not.toHaveCount(0);

    expect(errors).toEqual([]);
});
