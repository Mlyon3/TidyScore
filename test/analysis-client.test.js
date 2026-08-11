import { describe, expect, it, vi } from 'vitest';
import { analysisClient } from '../src/core/analysis-client.js';
import { createBaseState } from '../src/core/state.js';
import { assignRowIds, buildRowsById } from '../src/core/row-identity.js';

class FakeWorker {
    constructor() {
        this.listeners = new Map();
        this.messages = [];
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    postMessage(message) { this.messages.push(message); }
    respond(data) { this.listeners.get('message')({ data }); }
    fail() { this.listeners.get('error')(); }
    terminate() {}
}

function makeApp(worker) {
    const data = assignRowIds([{ Title: 'Prelude', Composers: '', Genre: '', Tags: '' }]);
    return Object.assign(createBaseState(), analysisClient, {
        data,
        dataById: buildRowsById(data),
        headers: ['Title', 'Composers', 'Genre', 'Tags'],
        titleField: 'Title',
        composerField: 'Composers',
        genreField: 'Genre',
        tagsField: 'Tags',
        settings: { version: 2 },
        _workerFactory: () => worker,
        updateAnalysisState: vi.fn(),
        updateScanResults: vi.fn()
    });
}

const emptyScan = {
    counts: { missingComposer: 0, composerFormatting: 0, imslpTitles: 0, quickClean: 0 },
    candidates: { missingComposer: [], composerFormatting: [], imslpTitles: [], quickClean: [] },
    extractionSignals: { checked: 1, skipped: 0, titleCount: 0, completionCount: 0 }
};

describe('analysis worker client', () => {
    it('uses request IDs and caches unchanged row scans', async () => {
        const worker = new FakeWorker();
        const app = makeApp(worker);
        const first = app.requestScanAnalysis();
        expect(worker.messages[0].requestId).toBe(1);
        worker.respond({ requestId: 1, ok: true, result: [{ id: 0, result: emptyScan }] });
        expect((await first).ok).toBe(true);

        const second = await app.requestScanAnalysis();
        expect(second.ok).toBe(true);
        expect(worker.messages).toHaveLength(1);
    });

    it('discards stale responses after invalidation', async () => {
        const worker = new FakeWorker();
        const app = makeApp(worker);
        const request = app.requestScanAnalysis();
        app.invalidateAnalysis();
        worker.respond({ requestId: 1, ok: true, result: [{ id: 0, result: emptyScan }] });

        expect(await request).toMatchObject({ ok: false, code: 'STALE_ANALYSIS' });
        expect(app.scanResults).toBeNull();
    });

    it('sends only rows whose cached field values changed', async () => {
        const worker = new FakeWorker();
        const app = makeApp(worker);
        const secondRow = assignRowIds([{ Title: 'Fugue', Composers: '', Genre: '', Tags: '' }], [1])[0];
        app.data.push(secondRow);
        app.dataById.set(1, secondRow);

        const initial = app.requestScanAnalysis();
        worker.respond({
            requestId: 1,
            ok: true,
            result: [{ id: 0, result: emptyScan }, { id: 1, result: emptyScan }]
        });
        await initial;

        secondRow.Title = 'Changed Fugue';
        const changed = app.requestScanAnalysis();
        expect(worker.messages[1].payload.rows.map(row => row.id)).toEqual([1]);
        worker.respond({ requestId: 2, ok: true, result: [{ id: 1, result: emptyScan }] });
        expect((await changed).ok).toBe(true);
    });

    it('exposes a retryable unavailable state after worker failure', async () => {
        const worker = new FakeWorker();
        const app = makeApp(worker);
        const request = app.requestScanAnalysis();
        worker.fail();

        expect(await request).toMatchObject({ ok: false, code: 'ANALYSIS_WORKER_FAILURE' });
        expect(app.analysisState.status).toBe('unavailable');
    });

    it('does not queue interactive analysis behind a background scan', async () => {
        const backgroundWorker = new FakeWorker();
        const interactiveWorker = new FakeWorker();
        const app = makeApp(backgroundWorker);
        app._workerFactory = vi.fn()
            .mockReturnValueOnce(backgroundWorker)
            .mockReturnValueOnce(interactiveWorker);

        const scan = app.requestScanAnalysis();
        const extraction = app.requestComposerExtraction([0]);

        expect(backgroundWorker.messages[0].type).toBe('scan');
        expect(interactiveWorker.messages[0].type).toBe('composerExtraction');
        interactiveWorker.respond({
            requestId: interactiveWorker.messages[0].requestId,
            ok: true,
            result: { titleExtractions: [], nameCompletions: [], checked: 1, skipped: 0 }
        });
        expect((await extraction).ok).toBe(true);

        backgroundWorker.respond({
            requestId: backgroundWorker.messages[0].requestId,
            ok: true,
            result: [{ id: 0, result: emptyScan }]
        });
        expect((await scan).ok).toBe(true);
    });
});
