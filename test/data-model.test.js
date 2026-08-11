import { describe, expect, it } from 'vitest';
import {
    buildExportDiffSummary,
    buildExportReviewSummary,
    countModifiedFields,
    resolveLibraryFields
} from '../src/core/data-model.js';

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
    const original = [{ __id: 0, Title: 'Prelude', Composers: 'Bach' }];

    it('counts current field differences', () => {
        expect(countModifiedFields(
            [{ __id: 0, Title: 'Prelude in C', Composers: 'Bach' }],
            original,
            headers
        )).toBe(1);
    });

    it('returns to zero when an edited value is restored', () => {
        const data = [{ __id: 0, Title: 'Prelude in C', Composers: 'Bach' }];
        data[0].Title = 'Prelude';
        expect(countModifiedFields(data, original, headers)).toBe(0);
    });
});

describe('export diff summary', () => {
    const headers = ['Title', 'Composers', 'Genre', 'Tags', 'Filename'];
    const original = [
        { __id: 0, Title: 'Prelude', Composers: 'Bach', Genre: '', Tags: 'Favorite', Filename: 'prelude.pdf' },
        { __id: 1, Title: '', Composers: '', Genre: 'Study', Tags: '', Filename: 'etude.pdf' }
    ];

    it('groups every changed field by score with accurate counts and identity', () => {
        const data = JSON.parse(JSON.stringify(original));
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

    it('falls back to the original title, then filename, for score identity', () => {
        const renamed = [{ ...original[0], Title: '' }];
        const filenameOnlyOriginal = [{ ...original[1], Filename: 'fallback.pdf' }];
        const filenameOnlyCurrent = [{ ...filenameOnlyOriginal[0], Genre: 'Romantic' }];

        expect(buildExportDiffSummary(renamed, [original[0]], headers).groups[0].title).toBe('Prelude');
        expect(buildExportDiffSummary(filenameOnlyCurrent, filenameOnlyOriginal, headers).groups[0].title).toBe('fallback.pdf');
    });

    it('retains reverted candidates and reconciles later external edits', () => {
        const candidates = new Map();
        const data = [{ ...original[0], Genre: 'Baroque', Tags: 'Favorite, Recital' }];

        let summary = buildExportReviewSummary(data, [original[0]], headers, candidates);
        expect(summary.changedFieldCount).toBe(2);
        expect(summary.revertedCount).toBe(0);

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
