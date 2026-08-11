import { createApp } from '../main.js';
import { assignRowIds, buildRowsById } from '../core/row-identity.js';

function buildWorkerApp(payload) {
    const app = createApp();
    app.headers = [...payload.headers];
    app.settings = payload.settings;
    app._settingsRevision = payload.settingsRevision || 0;
    app.data = payload.rows.map(row => row.fields);
    assignRowIds(app.data, payload.rows.map(row => row.id));
    app.dataById = buildRowsById(app.data);
    app.analyzeData();
    const aliasMap = app.getComposerAliasMap();
    app.getComposerAliasMap = () => aliasMap;
    return app;
}

self.addEventListener('message', event => {
    const { requestId, type, payload } = event.data || {};
    try {
        const app = buildWorkerApp(payload);
        if (type === 'scan') {
            const result = payload.rows.map(row => ({
                id: row.id,
                result: app.computeScanResults([row.id])
            }));
            self.postMessage({ requestId, ok: true, result });
            return;
        }
        if (type === 'duplicates') {
            const result = app.detectDuplicates(payload.rows.map(row => row.id), { pairBudget: payload.pairBudget });
            self.postMessage({ requestId, ...result });
            return;
        }
        if (type === 'composerExtraction') {
            const result = app.getComposerExtractionSignals(payload.rows.map(row => row.id));
            self.postMessage({ requestId, ok: true, result });
            return;
        }
        self.postMessage({ requestId, ok: false, code: 'UNKNOWN_ANALYSIS_TYPE', message: 'Unknown analysis request.' });
    } catch (error) {
        self.postMessage({
            requestId,
            ok: false,
            code: 'ANALYSIS_WORKER_FAILURE',
            message: 'Analysis failed. Editing and export are still available.',
            details: { name: error?.name || 'Error' }
        });
    }
});
