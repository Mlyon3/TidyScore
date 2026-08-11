import { describe, expect, it } from 'vitest';
import {
    buildExportDiffSummary,
    buildExportReviewSummary,
    countModifiedFields,
    resolveLibraryFields
} from '../src/core/data-model.js';
import { assignRowIds, cloneRowsWithIds } from '../src/core/row-identity.js';

function identified(rows) {
    const ids = rows.map((row, index) => Number.isInteger(row.__id) ? row.__id : index);
    const copies = rows.map(({ __id: _ignored, ...fields }) => fields);
    return assignRowIds(copies, ids);
}

describe('library field mapping', () => {
    it('maps supported columns case-insensitively while preserving source headers', () => {
        expect(resolveLibraryFields(['TITLE', 'composer', 'Genres', 'Tag', 'File'])).toEqual({
            title: 'TITLE',
            composer: 'composer',
            genre: 'Genres',
            tags: 'Tag',
            filename: 'File'
        });
    });
});

describe('modification state', () => {
    const headers = ['Title', 'Composers'];
    const original = identified([{ __id: 0, Title: 'Prelude', Composers: 'Bach' }]);

    it('counts current field differences', () => {
        expect(countModifiedFields(
            identified([{ __id: 0, Title: 'Prelude in C', Composers: 'Bach' }]),
            original,
            headers
        )).toBe(1);
    });

    it('returns to zero when an edited value is restored', () => {
        const data = identified([{ __id: 0, Title: 'Prelude in C', Composers: 'Bach' }]);
        data[0].Title = 'Prelude';
        expect(countModifiedFields(data, original, headers)).toBe(0);
    });
});

describe('export diff summary', () => {
    const headers = ['Title', 'Composers', 'Genre', 'Tags', 'Filename'];
    const original = identified([
        { __id: 0, Title: 'Prelude', Composers: 'Bach', Genre: '', Tags: 'Favorite', Filename: 'prelude.pdf' },
        { __id: 1, Title: '', Composers: '', Genre: 'Study', Tags: '', Filename: 'etude.pdf' }
    ]);

    it('groups every changed field by score with accurate counts and identity', () => {
        const data = cloneRowsWithIds(original);
        data[0].Genre = 'Baroque';
        data[0].Tags = 'Favorite, Recital';
        data[1].Title = 'Etude';

        expect(buildExportDiffSummary(data, original, headers)).toEqual({
            changedFieldCount: 3,
            changedScoreCount: 2,
            fieldCounts: { Title: 1, Genre: 1, Tags: 1 },
            groups: [
                {
                    rowId: 0,
                    rowNum: 1,
                    title: 'Prelude',
                    composer: 'Bach',
                    changes: [
                        { field: 'Genre', oldValue: '', newValue: 'Baroque' },
                        { field: 'Tags', oldValue: 'Favorite', newValue: 'Favorite, Recital' }
                    ]
                },
                {
                    rowId: 1,
                    rowNum: 2,
                    title: 'Etude',
                    composer: 'Composer unknown',
                    changes: [{ field: 'Title', oldValue: '', newValue: 'Etude' }]
                }
            ]
        });
    });

    it('falls back to the original title without exposing filenames', () => {
        const renamed = identified([{ ...original[0], __id: 0, Title: '' }]);
        const filenameOnlyOriginal = identified([{ ...original[1], __id: 1, Filename: 'fallback.pdf' }]);
        const filenameOnlyCurrent = identified([{ ...filenameOnlyOriginal[0], __id: 1, Genre: 'Romantic' }]);

        expect(buildExportDiffSummary(renamed, [original[0]], headers).groups[0].title).toBe('Prelude');
        expect(buildExportDiffSummary(filenameOnlyCurrent, filenameOnlyOriginal, headers).groups[0].title).toBe('Untitled score');
    });

    it('retains reverted candidates and reconciles later external edits', () => {
        const candidates = new Map();
        const data = identified([{ ...original[0], __id: 0, Genre: 'Baroque', Tags: 'Favorite, Recital' }]);

        let summary = buildExportReviewSummary(data, [original[0]], headers, candidates);
        expect(summary.changedFieldCount).toBe(2);
        expect(summary.revertedCount).toBe(0);
        expect(summary.groups[0].details).toEqual({
            title: 'Prelude',
            composer: 'Bach',
            genre: 'Baroque',
            tags: 'Favorite, Recital'
        });
        expect(summary.groups[0].details).not.toHaveProperty('filename');

        data[0].Genre = '';
        summary = buildExportReviewSummary(data, [original[0]], headers, candidates);
        expect(summary.changedFieldCount).toBe(1);
        expect(summary.revertedCount).toBe(1);
        expect(summary.groups[0].changes.find(change => change.field === 'Genre')).toMatchObject({
            oldValue: '',
            newValue: 'Baroque',
            included: false
        });

        data[0].Genre = 'Modern';
        summary = buildExportReviewSummary(data, [original[0]], headers, candidates);
        expect(summary.changedFieldCount).toBe(2);
        expect(summary.groups[0].changes.find(change => change.field === 'Genre')).toMatchObject({
            newValue: 'Modern',
            included: true
        });
    });
});
