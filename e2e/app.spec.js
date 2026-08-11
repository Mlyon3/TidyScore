import { expect, test } from '@playwright/test';

test('sample cleanup, undo, and duplicate detection work without console errors', async ({ page }) => {
    const errors = [];
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/TidyScore/');
    await expect(page.getByRole('heading', { name: 'Get your library CSV from forScore' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'See step-by-step instructions' })).toBeVisible();
    await expect(page.getByText('How does the forScore round trip work?')).toHaveCount(0);

    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.locator('#settingsModal')).toHaveClass(/active/);
    await page.locator('#settingsCancelBtn').click();

    await page.getByRole('link', { name: 'Try a sample library' }).click();
    await expect(page.locator('#totalScores')).toHaveText('49');
    await expect(page.getByRole('heading', { name: 'Recommended fixes' })).toBeVisible();

    await page.getByRole('button', { name: 'Fix composers' }).click();
    await expect(page.locator('#extractionModal')).toHaveClass(/active/);
    await expect(page.locator('#extractionResults')).toContainText('Johannes Brahms, Ludwig van Beethoven');
    await expect(page.locator('#extractionResults')).toContainText('Carl Philipp Emanuel Bach, Johann Sebastian Bach');
    await expect(page.locator('#extractionResults')).toContainText('Kapustin');
    await page.getByRole('button', { name: 'Apply Selected' }).click();
    await expect(page.locator('#undoBtn')).toBeEnabled();
    await page.locator('#undoBtn').click();

    await page.locator('#advancedTools > summary').click();
    await expect(page.locator('#advancedTools .btn-tool-label')).toHaveText([
        'Find Duplicates',
        'Find & Replace',
        'More Tools'
    ]);
    await page.getByRole('button', { name: 'Find Duplicates' }).click();
    await expect(page.locator('#duplicateModal')).toHaveClass(/active/);
    await expect(page.locator('#duplicateResults .dup-group')).not.toHaveCount(0);
    await expect(page.locator('#duplicateResults .dup-badge-likely')).not.toHaveCount(0);
    await expect(page.locator('#duplicateResults .dup-badge-possible')).not.toHaveCount(0);
    await expect(page.locator('#duplicateResults .dup-badge-related')).not.toHaveCount(0);

    expect(errors).toEqual([]);
});

test('multi-composer extraction flags incomplete title lists and uses first-last output', async ({ page }) => {
    await page.goto('/TidyScore/');

    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.locator('#settingsComposerNameDisplayFormat')).toHaveCount(0);
    await expect(page.locator('#settingsModal')).toContainText('Composer names use First Last format');
    await page.locator('#settingsCancelBtn').click();

    await page.evaluate(() => {
        window.app.parseCSV([
            'Title,Composers,Genre,Tags,Filename',
            'Sonatas Brahms Tchiak Beethoven,,,,partial.pdf'
        ].join('\n'));
    });

    await page.getByRole('button', { name: 'Fix composers' }).click();
    const result = page.locator('#extractionResults .extraction-item').first();
    await expect(result).toContainText('Johannes Brahms, Ludwig van Beethoven');
    await expect(result).toContainText('May be incomplete');
    await expect(result).toContainText('Tchiak');
    await expect(result.locator('.extraction-checkbox')).not.toBeChecked();

    await result.locator('.extraction-checkbox').check();
    await page.getByRole('button', { name: 'Apply Selected' }).click();
    expect(await page.evaluate(() => window.app.data[0].Composers))
        .toBe('Johannes Brahms, Ludwig van Beethoven');
});

test('duplicate review explains evidence and tags a unique review queue', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/TidyScore/');
    await page.evaluate(() => {
        window.app.parseCSV([
            'Title,Composers,Genre,Tags,Filename',
            'Concerto Full Score,Example,,,concerto-score.pdf',
            'Concerto Full Score (2),Example,,,concerto-score-copy.pdf',
            'Concerto Violin Part,Example,,,concerto-violin-part.pdf',
            'Etude Violin,Example,,,etude-vln.pdf',
            'Etude,Example,,,etude-scan.pdf'
        ].join('\n'));
    });

    await page.locator('#advancedTools > summary').click();
    await page.getByRole('button', { name: 'Find Duplicates' }).click();
    const modal = page.locator('#duplicateModal');
    await expect(modal).toHaveClass(/active/);
    await expect(modal).toContainText('annotations');
    await expect(modal).toContainText('compare every');
    await expect(modal.locator('.dup-badge-likely')).toHaveText('Likely duplicate');
    await expect(modal.locator('.dup-badge-possible')).toHaveText('Possible duplicate');
    await expect(modal.locator('.dup-badge-related')).toHaveText('Related / likely separate');
    await expect(modal.locator('.dup-summary')).toHaveCount(3);
    await expect(modal.locator('#dupSelectedCount')).toHaveText('2 of 5 unique files selected');

    await modal.locator('.dup-evidence summary').first().click();
    await expect(modal.locator('.dup-evidence').first()).toContainText('Matches');
    await modal.locator('.dup-evidence summary').last().click();
    await expect(modal.locator('.dup-evidence').last()).toContainText('Differences');

    await modal.locator('.dup-group').filter({ hasText: 'Possible duplicate' }).locator('.dup-group-checkbox').click();
    await expect(modal.locator('#dupSelectedCount')).toHaveText('4 of 5 unique files selected');
    await page.getByRole('button', { name: "Tag Selected as '_Duplicate_Delete_Me'" }).click();

    const tags = await page.evaluate(() => window.app.data.map(row => row.Tags));
    expect(tags).toEqual([
        '_Duplicate_Delete_Me',
        '_Duplicate_Delete_Me',
        '',
        '_Duplicate_Delete_Me',
        '_Duplicate_Delete_Me'
    ]);

    await page.getByRole('button', { name: 'Find Duplicates' }).click();
    await expect(modal.locator('#dupSelectedCount')).toHaveText('2 of 5 unique files selected');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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

test('export summary identifies scores and toggles Genre and Tags independently', async ({ page }) => {
    await page.setViewportSize({ width: 540, height: 720 });
    await page.goto('/TidyScore/');
    await page.getByRole('link', { name: 'Try a sample library' }).click();
    await page.locator('#libraryEditor > summary').click();

    const firstRow = page.locator('#tableBody tr').first();
    await firstRow.locator('td[data-label="Genre"]').click();
    await firstRow.locator('input.editing').fill('Test Genre');
    await page.locator('#reviewHeading').click();
    await expect(page.locator('#modifiedCount')).toHaveText('1');

    const refreshedFirstRow = page.locator('#tableBody tr').first();
    await refreshedFirstRow.locator('td[data-label="Tags"]').click();
    await refreshedFirstRow.locator('input.editing').fill('Favorite, Recital');
    await page.locator('#reviewHeading').click();
    await expect(page.locator('#modifiedCount')).toHaveText('2');

    await page.getByRole('button', { name: /Review & Export/ }).click();
    await expect(page.locator('#exportSummaryDesc')).toContainText('2 changes selected across 1 score');
    await expect(page.locator('#exportFieldBreakdown')).toContainText('Genre 1');
    await expect(page.locator('#exportFieldBreakdown')).toContainText('Tags 1');
    await expect(page.locator('.export-score-title')).not.toBeEmpty();
    await expect(page.locator('.export-score-meta')).toContainText('Row 1');

    const detailsButton = page.getByRole('button', { name: /Show details for/ });
    await detailsButton.click();
    await expect(page.getByRole('button', { name: /Hide details for/ })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.export-score-details')).toContainText('Test Genre');
    await expect(page.locator('.export-score-details')).toContainText('Favorite, Recital');
    await expect(page.locator('.export-score-details')).not.toContainText('Filename');

    const genreToggle = page.getByRole('button', { name: /Use original Genre value for/ });
    const tagsToggle = page.getByRole('button', { name: /Use original Tags value for/ });
    await expect(genreToggle).toHaveAttribute('aria-pressed', 'true');
    await genreToggle.click();
    await expect(page.locator('#exportSummaryDesc')).toContainText('1 change selected across 1 score. 1 using original');
    await expect(page.getByRole('button', { name: /Hide details for/ })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.export-score-details')).not.toContainText('Test Genre');
    await expect(page.getByRole('button', { name: /Use changed Genre value for/ })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: /Use changed Genre value for/ })).toContainText('Using original');
    await expect(tagsToggle).toHaveCount(1);

    await page.keyboard.press('Control+z');
    await expect(page.locator('#exportSummaryDesc')).toContainText('2 changes selected across 1 score');
    await expect(page.getByRole('button', { name: /Use original Genre value for/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.export-score-details')).toContainText('Test Genre');

    await page.getByRole('button', { name: /Use original Genre value for/ }).click();
    await page.getByRole('button', { name: /Use original Tags value for/ }).click();
    await expect(page.locator('#exportSummaryDesc')).toContainText('No changes selected for export. 2 changes are using original values');
    await expect(page.locator('.export-change-row')).toHaveCount(2);
    await expect(page.locator('.export-change-row[aria-pressed="false"]')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Save to Files' })).toBeEnabled();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: /Review & Export/ }).click();
    await expect(page.locator('.export-change-row[aria-pressed="false"]')).toHaveCount(2);

    await page.getByRole('button', { name: /Use changed Genre value for/ }).click();
    await expect(page.locator('#exportSummaryDesc')).toContainText('1 change selected across 1 score. 1 using original');
    await expect(page.getByRole('button', { name: /Use original Genre value for/ })).toContainText('Using change');
});

test('direct cell-to-cell editing commits once and Escape cancels', async ({ page }) => {
    await page.goto('/TidyScore/');
    await page.getByRole('link', { name: 'Try a sample library' }).click();
    await page.locator('#libraryEditor > summary').click();

    const firstRow = page.locator('#tableBody tr').first();
    await firstRow.locator('td[data-label="Genre"]').click();
    await firstRow.locator('input.editing').fill('Test Genre');
    await firstRow.locator('td[data-label="Tags"]').click();
    await firstRow.locator('input.editing').fill('Test Tags');
    await page.locator('#reviewHeading').click();

    expect(await page.evaluate(() => ({
        genre: window.app.data[0].Genre,
        tags: window.app.data[0].Tags,
        manualEdits: window.app.changeLog.find(change => change.category === 'Manual edits')?.count,
        undoEntries: window.app.undoStack.filter(entry => entry.label === 'Edit').length
    }))).toEqual({ genre: 'Test Genre', tags: 'Test Tags', manualEdits: 2, undoEntries: 2 });

    const refreshedFirstRow = page.locator('#tableBody tr').first();
    const originalTitle = await refreshedFirstRow.locator('td[data-label="Title"]').innerText();
    await refreshedFirstRow.locator('td[data-label="Title"]').click();
    await refreshedFirstRow.locator('input.editing').fill('Should not commit');
    await refreshedFirstRow.locator('input.editing').press('Escape');
    expect(await page.evaluate(() => window.app.data[0].Title)).toBe(originalTitle);

    await page.locator('#tableBody tr').first().locator('td[data-label="Composer"]').click();
    await page.locator('#tableBody tr').first().locator('input.editing').fill('Brahms');
    await page.evaluate(() => {
        const input = document.querySelector('#tableBody tr:first-child input.editing');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        document.querySelector('#tableBody tr:first-child td[data-label="Genre"]').click();
    });
    await page.waitForTimeout(20);
    expect(await page.evaluate(() => window.app._activeCellEdit?.field)).toBe('Genre');
    await page.locator('#tableBody tr').first().locator('input.editing').press('Escape');

    await page.locator('#tableBody tr').first().locator('td[data-label="Title"]').click();
    await page.locator('#tableBody tr').first().locator('input.editing').fill('Old library edit');
    await page.evaluate(() => window.app.parseCSV('Title,Composers,Genre,Tags,Filename\nNew library,,,,new.pdf', {
        sourceFileName: 'new.csv'
    }));
    expect(await page.evaluate(() => ({
        title: window.app.data[0].Title,
        filename: window.app.sourceFileName,
        undoDepth: window.app.undoStack.length
    }))).toEqual({ title: 'New library', filename: 'new.csv', undoDepth: 0 });
});

test('native undo remains available inside modal inputs', async ({ page }) => {
    await page.goto('/TidyScore/');
    await page.getByRole('link', { name: 'Try a sample library' }).click();
    await page.locator('#advancedTools > summary').click();
    await page.getByRole('button', { name: 'Find & Replace' }).click();

    const findInput = page.locator('#findText');
    await findInput.fill('native undo');
    const undoDepth = await page.evaluate(() => window.app.undoStack.length);
    await findInput.press('Meta+z');

    await expect(findInput).toHaveValue('');
    expect(await page.evaluate(() => window.app.undoStack.length)).toBe(undoDepth);
});

test('export summary reveals large change sets incrementally', async ({ page }) => {
    await page.goto('/TidyScore/');
    await page.evaluate(() => {
        const rows = Array.from({ length: 51 }, (_, index) =>
            `Score ${index + 1},Composer,,tag,file-${index + 1}.pdf`
        );
        window.app.parseCSV([
            'Title,Composers,Genre,Tags,Filename',
            ...rows
        ].join('\n'));
        window.app.data.forEach(row => { row.Genre = 'Changed'; });
        window.app.renderAll();
    });

    await page.getByRole('button', { name: /Review & Export/ }).click();
    await expect(page.locator('.export-score-group')).toHaveCount(50);

    await page.getByLabel('Search Export Summary').fill('Score 51');
    await expect(page.locator('#exportSearchResults')).toHaveText('Showing 1 of 51 scores');
    await expect(page.locator('.export-score-group')).toHaveCount(1);
    await expect(page.locator('.export-score-title')).toHaveText('Score 51');

    await page.getByRole('button', { name: 'Clear Export Summary search' }).click();
    await expect(page.locator('#exportSearchResults')).toBeHidden();
    await expect(page.locator('.export-score-group')).toHaveCount(50);
    await page.getByRole('button', { name: 'Show 1 more score' }).click();
    await expect(page.locator('.export-score-group')).toHaveCount(51);
});

test('opt-in recovery restores the current library after reload', async ({ page }) => {
    await page.goto('/TidyScore/');
    await page.getByRole('link', { name: 'Try a sample library' }).click();
    await page.getByLabel('Recover this session on this device').check();
    await expect(page.locator('#deleteSessionBtn')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Continue your previous local session?')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('#totalScores')).toHaveText('49');
});

test('guided workflow fits an iPad portrait viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/TidyScore/');
    await page.getByRole('link', { name: 'Try a sample library' }).click();

    await expect(page.getByRole('heading', { name: 'Recommended fixes' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: /Review & Export/ })).toBeVisible();
    await page.getByRole('button', { name: /Review & Export/ }).click();
    await expect(page.locator('#exportModal')).toHaveClass(/active/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('guided workflow fits iPad landscape and Split View widths', async ({ page }) => {
    for (const viewport of [{ width: 1024, height: 768 }, { width: 540, height: 720 }]) {
        await page.setViewportSize(viewport);
        await page.goto('/TidyScore/');
        await page.getByRole('link', { name: 'Try a sample library' }).click();

        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await expect(page.getByRole('button', { name: /Review & Export/ })).toBeVisible();
        await page.getByRole('button', { name: /Review & Export/ }).click();
        await expect(page.locator('#exportModal')).toHaveClass(/active/);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
});
