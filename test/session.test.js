import { describe, expect, it } from 'vitest';
import { validateSessionPayload } from '../src/core/session.js';

describe('local session schema', () => {
    it('migrates valid v1 sessions by row order without retaining internal IDs', () => {
        const result = validateSessionPayload({
            version: 1,
            sourceFileName: 'library.csv',
            headers: ['__id', 'Title', 'Tags'],
            data: [{ __id: 91, Title: 'First', Tags: 'constructor' }, { __id: 4, Title: 'Second', Tags: '__proto__' }],
            originalData: [{ __id: 91, Title: 'First', Tags: '' }, { __id: 4, Title: 'Second', Tags: '' }],
            changeLog: [],
            savedAt: '2026-08-11T00:00:00.000Z'
        });

        expect(result.ok).toBe(true);
        expect(result.value.version).toBe(2);
        expect(result.value.headers).toEqual(['Title', 'Tags']);
        expect(result.value.data).toEqual([
            expect.objectContaining({ Title: 'First', Tags: 'constructor' }),
            expect.objectContaining({ Title: 'Second', Tags: '__proto__' })
        ]);
        expect(result.value.data[0]).not.toHaveProperty('__id');
    });

    it('preserves a genuine __id column in v2 sessions', () => {
        const result = validateSessionPayload({
            version: 2,
            headers: ['__id', 'Title'],
            data: [{ __id: 'external', Title: 'Prelude' }],
            originalData: [{ __id: 'external', Title: 'Prelude' }],
            changeLog: []
        });

        expect(result.ok).toBe(true);
        expect(result.value.data[0].__id).toBe('external');
    });

    it('rejects corrupt headers and row data', () => {
        expect(validateSessionPayload({ version: 2, headers: ['Title', 'Title'], data: [{}] }).ok).toBe(false);
        expect(validateSessionPayload({ version: 2, headers: ['Title'], data: ['bad'] }).ok).toBe(false);
        expect(validateSessionPayload({ version: 2, headers: ['Title'], data: [{ Title: {} }] }).ok).toBe(false);
    });
});
