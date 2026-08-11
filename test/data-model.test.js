import { describe, expect, it } from 'vitest';
import { countModifiedFields, resolveLibraryFields } from '../src/core/data-model.js';

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
