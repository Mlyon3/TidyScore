import { buildComposerAliasMap, proposeComposerExtractions } from '../domain/composers.js';
import { resolveLibraryFields } from '../domain/data-model.js';
import { detectDuplicates } from '../domain/duplicates.js';
import { createLibrary } from '../domain/library.js';
import { computeScanResults } from '../domain/scan.js';

function buildWorkerContext(payload) {
    const library = createLibrary(
        resolveLibraryFields(payload.headers),
        new Map(payload.rows.map(row => [row.id, row.fields]))
    );
    return {
        library,
        ids: payload.rows.map(row => row.id),
        aliasMap: buildComposerAliasMap(payload.settings)
    };
}

self.addEventListener('message', event => {
    const { requestId, type, payload } = event.data || {};
    try {
        const { library, ids, aliasMap } = buildWorkerContext(payload);
        if (type === 'scan') {
            const result = ids.map(id => ({ id, result: computeScanResults(library, [id], aliasMap) }));
            self.postMessage({ requestId, ok: true, result });
            return;
        }
        if (type === 'duplicates') {
            const result = detectDuplicates(library, ids, { aliasMap, pairBudget: payload.pairBudget });
            self.postMessage({ requestId, ...result });
            return;
        }
        if (type === 'composerExtraction') {
            const result = proposeComposerExtractions(library, ids, aliasMap);
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
