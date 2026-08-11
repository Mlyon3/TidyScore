import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { buildExportFilename, canShareFile, csvCore, parseCsvDocument, serializeCsvDocument } from '../src/core/csv.js';

const fixtureUrl = new URL('./fixtures/forscore-roundtrip.csv', import.meta.url);

describe('CSV import and export', () => {
    it('round-trips quoted text, commas, Unicode, and multiline fields', () => {
        const imported = parseCsvDocument(readFileSync(fixtureUrl, 'utf8'));

        expect(imported.rows[0].Notes).toBe('He said "Hi"');
        expect(imported.rows[1].Notes).toBe('First line\nSecond line');

        const exported = serializeCsvDocument(imported.headers, imported.rows);
        expect(parseCsvDocument(exported)).toEqual(imported);
    });

    it('preserves unknown forScore columns through repeated round trips', () => {
        const imported = parseCsvDocument(readFileSync(fixtureUrl, 'utf8'));
        const once = parseCsvDocument(serializeCsvDocument(imported.headers, imported.rows));
        const twice = parseCsvDocument(serializeCsvDocument(once.headers, once.rows));

        expect(twice.headers).toContain('Notes');
        expect(twice).toEqual(imported);
    });

    it('handles a large library without changing row order', () => {
        const rows = Array.from({ length: 1500 }, (_, index) => ({
            Title: `Score ${index + 1}`,
            Composers: index % 2 ? 'Bach, Johann Sebastian' : 'Mozart, Wolfgang Amadeus',
            CustomField: `value-${index + 1}`
        }));
        const reparsed = parseCsvDocument(serializeCsvDocument(['Title', 'Composers', 'CustomField'], rows));

        expect(reparsed.rows).toHaveLength(1500);
        expect(reparsed.rows[0].Title).toBe('Score 1');
        expect(reparsed.rows[1499].CustomField).toBe('value-1500');
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

describe('export compatibility helpers', () => {
    it('builds a recognizable source-and-date filename', () => {
        expect(buildExportFilename('My forScore Export.csv', new Date('2026-08-10T12:00:00Z')))
            .toBe('My-forScore-Export-tidyscore-2026-08-10.csv');
    });

    it('detects supported file sharing without throwing', () => {
        const file = { name: 'library.csv' };
        expect(canShareFile({ share() {}, canShare: () => true }, file)).toBe(true);
        expect(canShareFile({ share() {}, canShare: () => { throw new Error('unsupported'); } }, file)).toBe(false);
        expect(canShareFile({}, file)).toBe(false);
    });
});
