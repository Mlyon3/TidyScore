import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/main.js';
import { assignRowIds, buildRowsById } from '../src/domain/row-identity.js';

// An app instance over in-memory rows, with DOM-bound rendering stubbed out.
function appWithRows(rows) {
    const app = createApp();
    app.data = assignRowIds(rows);
    app.dataById = buildRowsById(app.data);
    app.headers = Object.keys(rows[0]);
    app.analyzeData();
    app.filteredIds = app.data.map((_, index) => index);
    Object.assign(app, {
        pushUndo: vi.fn(),
        logChange: vi.fn(),
        renderTable: vi.fn(),
        renderAll: vi.fn(),
        updateStats: vi.fn(),
        showNotification: vi.fn(),
        closeDuplicateModal: vi.fn()
    });
    return app;
}

describe('app instances', () => {
    it('creates isolated mutable state for each instance', () => {
        const app = createApp();
        const other = createApp();
        app.data.push({ Title: 'Only here' });
        app.selectedIds.add(12);

        expect(other.data).toEqual([]);
        expect(other.selectedIds.size).toBe(0);
    });

    it('rebuilds the cached composer alias map when settings change', () => {
        const app = createApp();
        app.settings = { version: 2, composer: { library: { mode: 'builtin_plus_custom', customAliases: {}, blacklistedAliases: [] } } };
        const before = app.getComposerAliasMap();
        expect(app.getComposerAliasMap()).toBe(before);

        app.settings = { ...app.settings, composer: { library: { mode: 'builtin_plus_custom', customAliases: { beeth: 'Ludwig van Beethoven' }, blacklistedAliases: [] } } };
        expect(app.getComposerAliasMap()).not.toBe(before);
        expect(app.normalizeComposerValue('beeth').formatted).toBe('Ludwig van Beethoven');
    });
});

describe('duplicate review tagging', () => {
    it('tags unique selected rows once, preserves tags, and remains undoable', () => {
        const app = appWithRows([
            { Title: 'A', Tags: 'Favorite' },
            { Title: 'B', Tags: '_Duplicate_Delete_Me' }
        ]);
        app._dupSelected = new Set([0, 1]);

        app.applyDuplicateTags();
        expect(app.data[0].Tags).toBe('Favorite;_Duplicate_Delete_Me');
        expect(app.data[1].Tags).toBe('_Duplicate_Delete_Me');
        expect(app.modifiedCount).toBe(1);
        expect(app.pushUndo).toHaveBeenCalledWith('Tag Duplicates');
        expect(app.showNotification).toHaveBeenCalledWith(expect.stringContaining('Compare every tagged file'));
    });
});

describe('batch tag editing', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('writes tags with the same separator Quick Clean produces', () => {
        const app = appWithRows([{ Title: 'Prelude', Tags: 'piano;keyboard' }]);
        vi.stubGlobal('document', { getElementById: () => ({ value: 'study', focus: vi.fn() }) });

        app.batchAddTag();
        expect(app.data[0].Tags).toBe('piano;keyboard;study');
    });

    it('does not record an undo step when nothing changes', () => {
        const app = appWithRows([{ Title: 'Prelude', Tags: 'piano' }]);

        app.batchRemoveTag('violin');
        expect(app.pushUndo).not.toHaveBeenCalled();
        expect(app.data[0].Tags).toBe('piano');
    });
});
