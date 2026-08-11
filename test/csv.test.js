import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { csvCore, parseCsvDocument, serializeCsvDocument } from '../src/core/csv.js';

const fixtureUrl = new URL('./fixtures/forscore-roundtrip.csv', import.meta.url);

describe('CSV import and export', () => {
    it('round-trips quoted text, commas, Unicode, and multiline fields', () => {
        const imported = parseCsvDocument(readFileSync(fixtureUrl, 'utf8'));

        expect(imported.rows[0].Notes).toBe('He said "Hi"');
        expect(imported.rows[1].Notes).toBe('First line\nSecond line');

        const exported = serializeCsvDocument(imported.headers, imported.rows);
        expect(parseCsvDocument(exported)).toEqual(imported);
    });

    it('rejects empty input with a useful error', () => {
        expect(() => parseCsvDocument('')).toThrow(/No data found/);
    });

    it('rejects records whose column counts do not match the header', () => {
        expect(() => parseCsvDocument('Title,Composers\nOne,Bach,Extra'))
            .toThrow(/expected 2 columns but found 3/);
    });

    it('rejects malformed quoted fields', () => {
        expect(() => parseCsvDocument('Title,Notes\nWork,"unterminated'))
            .toThrow(/Invalid CSV/);
    });

    it('reports invalid input without replacing the current library', () => {
        const existingData = [{ __id: 0, Title: 'Keep me' }];
        const context = { data: existingData, showNotification: vi.fn() };

        csvCore.parseCSV.call(context, '');

        expect(context.data).toBe(existingData);
        expect(context.showNotification).toHaveBeenCalledWith(expect.stringMatching(/No data found/));
    });

    it('requires an identity column without partially importing rows', () => {
        const existingData = [{ __id: 0, Title: 'Keep me' }];
        const context = { data: existingData, showNotification: vi.fn() };

        csvCore.parseCSV.call(context, 'Genre,Tags\nClassical,piano');

        expect(context.data).toBe(existingData);
        expect(context.showNotification).toHaveBeenCalledWith(expect.stringMatching(/Title or Filename/));
    });
});
