import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildExportFilename,
    canShareFile,
    csvCore,
    parseCsvDocument,
    SAMPLE_LIBRARY_CSV,
    serializeCsvDocument
} from '../src/core/csv.js';
import { getRowId } from '../src/core/row-identity.js';

const fixtureUrl = new URL('./fixtures/forscore-roundtrip.csv', import.meta.url);
const originalFileReader = globalThis.FileReader;

afterEach(() => {
    globalThis.FileReader = originalFileReader;
});

describe('CSV import and export', () => {
    it('round-trips quoted text, commas, Unicode, and multiline fields', () => {
        const imported = parseCsvDocument(readFileSync(fixtureUrl, 'utf8'));

        expect(imported.rows[0].Notes).toBe('He said "Hi"');
        expect(imported.rows[1].Notes).toBe('First line\nSecond line');

        const exported = serializeCsvDocument(imported.headers, imported.rows);
        expect(parseCsvDocument(exported)).toEqual(imported);
    });

    it('round-trips a comma-separated forScore composer list', () => {
        const rows = [{ Title: 'Sonatas', Composers: 'Antonín Dvořák, Johannes Brahms' }];
        const exported = serializeCsvDocument(['Title', 'Composers'], rows);

        expect(exported).toContain('"Antonín Dvořák, Johannes Brahms"');
        expect(parseCsvDocument(exported).rows[0].Composers)
            .toBe('Antonín Dvořák, Johannes Brahms');
    });

    it('includes expanded composer and duplicate-review examples in the sample library', () => {
        const sample = parseCsvDocument(SAMPLE_LIBRARY_CSV);

        expect(sample.rows).toHaveLength(49);
        expect(sample.rows).toEqual(expect.arrayContaining([
            expect.objectContaining({ Title: 'Moonlight Sonata (2)', Composers: 'Beethoven, Ludwig van' }),
            expect.objectContaining({ Title: 'Academic Festival Overture Violin Part' }),
            expect.objectContaining({ Title: 'Brahms and Beethoven - Variations', Composers: '' }),
            expect.objectContaining({ Title: 'C.P.E. Bach and J.S. Bach - Two Bachs', Composers: '' }),
            expect.objectContaining({ Composers: 'Antonin Dvorak, Johannes Brahms' })
        ]));
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

    it('keeps data and filename atomic when an import fails', () => {
        const existingData = [{ Title: 'Keep me' }];
        const context = {
            data: existingData,
            sourceFileName: 'current.csv',
            showNotification: vi.fn()
        };

        const result = csvCore.parseCSV.call(context, 'Genre,Tags\nClassical,piano', { sourceFileName: 'bad.csv' });

        expect(result).toMatchObject({ ok: false, code: 'MISSING_IDENTITY_FIELD' });
        expect(context.data).toBe(existingData);
        expect(context.sourceFileName).toBe('current.csv');
    });

    it('round-trips a genuine __id column without exposing internal identity', () => {
        const context = {
            data: [], originalData: [], dataById: new Map(), originalDataById: new Map(),
            headers: [], selectedIds: new Set(), undoStack: [], exportReviewCandidates: new Map(),
            sourceFileName: 'before.csv', showNotification: vi.fn(), analyzeData: vi.fn(), renderAll: vi.fn()
        };

        expect(csvCore.parseCSV.call(context, '__id,Title\nexternal-42,Prelude', { sourceFileName: 'ids.csv' }))
            .toEqual({ ok: true });
        expect(Object.keys(context.data[0])).toEqual(['__id', 'Title']);
        expect(context.data[0].__id).toBe('external-42');
        expect(getRowId(context.data[0])).toBe(0);
        expect(JSON.stringify(context.data[0])).toBe('{"__id":"external-42","Title":"Prelude"}');
        expect(serializeCsvDocument(context.headers, context.data)).toContain('external-42,Prelude');
    });

    it('discards stale file-reader completions', () => {
        class FakeFileReader {
            static LOADING = 1;
            constructor() {
                this.readyState = FakeFileReader.LOADING;
                FakeFileReader.instances.push(this);
            }
            readAsText(file) { this.file = file; }
            abort() { this.readyState = 2; this.onabort?.(); }
        }
        FakeFileReader.instances = [];
        globalThis.FileReader = FakeFileReader;
        const context = {
            _fileReadGeneration: 0,
            _activeFileReader: null,
            showNotification: vi.fn(),
            parseCSV: vi.fn()
        };

        csvCore.handleFile.call(context, { name: 'older.csv' });
        const older = FakeFileReader.instances[0];
        csvCore.handleFile.call(context, { name: 'newer.csv' });
        const newer = FakeFileReader.instances[1];
        older.onload({ target: { result: 'old' } });
        newer.onload({ target: { result: 'new' } });

        expect(context.parseCSV).toHaveBeenCalledTimes(1);
        expect(context.parseCSV).toHaveBeenCalledWith('new', { sourceFileName: 'newer.csv', requestGeneration: 2 });

        context.parseCSV.mockClear();
        csvCore.handleFile.call(context, { name: 'third.csv' });
        const third = FakeFileReader.instances[2];
        csvCore.handleFile.call(context, { name: 'not-csv.txt' });
        third.onload({ target: { result: 'third' } });
        expect(context.parseCSV).not.toHaveBeenCalled();
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
