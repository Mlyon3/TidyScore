import { getRowId } from './row-identity.js';

const ANALYSIS_ERROR = 'ANALYSIS_WORKER_FAILURE';

function combineScanResults(entries) {
    const combined = {
        counts: { missingComposer: 0, composerFormatting: 0, imslpTitles: 0, quickClean: 0 },
        candidates: { missingComposer: [], composerFormatting: [], imslpTitles: [], quickClean: [] },
        extractionSignals: { checked: 0, skipped: 0, titleCount: 0, completionCount: 0 }
    };
    for (const entry of entries) {
        const result = entry.result;
        for (const key of Object.keys(combined.counts)) {
            combined.counts[key] += result.counts[key] || 0;
            combined.candidates[key].push(...(result.candidates[key] || []));
        }
        for (const key of Object.keys(combined.extractionSignals)) {
            combined.extractionSignals[key] += result.extractionSignals[key] || 0;
        }
    }
    return combined;
}

export const analysisClient = {
    _ensureAnalysisWorker(channel = 'background') {
        const workerProperty = channel === 'interactive'
            ? '_interactiveAnalysisWorker'
            : '_analysisWorker';
        if (this[workerProperty]) return this[workerProperty];
        const factory = this._workerFactory || (() => new Worker(
            new URL('../workers/analysis-worker.js', import.meta.url),
            { type: 'module' }
        ));
        try {
            const worker = factory();
            worker.addEventListener('message', event => {
                const pending = this._analysisPending.get(event.data?.requestId);
                if (!pending) return;
                this._analysisPending.delete(event.data.requestId);
                pending.resolve(event.data);
            });
            const fail = () => this._handleAnalysisWorkerFailure(channel);
            worker.addEventListener('error', fail);
            worker.addEventListener('messageerror', fail);
            this[workerProperty] = worker;
            return worker;
        } catch (_) {
            this._handleAnalysisWorkerFailure(channel);
            return null;
        }
    },

    _handleAnalysisWorkerFailure(channel = 'background') {
        const message = 'Analysis is unavailable. Editing and export still work; retry when ready.';
        for (const [requestId, pending] of this._analysisPending) {
            if (pending.channel !== channel) continue;
            pending.resolve({ ok: false, code: ANALYSIS_ERROR, message });
            this._analysisPending.delete(requestId);
        }
        const workerProperty = channel === 'interactive'
            ? '_interactiveAnalysisWorker'
            : '_analysisWorker';
        this[workerProperty]?.terminate?.();
        this[workerProperty] = null;
        this.analysisState = { status: 'unavailable', message };
        this.updateAnalysisState?.();
    },

    _postAnalysisRequest(type, payload, { channel = 'background' } = {}) {
        const worker = this._ensureAnalysisWorker(channel);
        if (!worker) {
            return Promise.resolve({ ok: false, code: ANALYSIS_ERROR, message: this.analysisState.message });
        }
        const requestId = ++this._analysisRequestSequence;
        return new Promise(resolve => {
            this._analysisPending.set(requestId, { resolve, channel });
            worker.postMessage({ requestId, type, payload });
        });
    },

    _serializeAnalysisRows(ids) {
        return ids.map(id => {
            const row = this.dataById.get(id);
            if (!row) return null;
            return {
                id,
                fields: Object.fromEntries(this.headers.map(header => [header, String(row[header] ?? '')]))
            };
        }).filter(Boolean);
    },

    invalidateAnalysis({ clearCache = false } = {}) {
        this._analysisGeneration++;
        clearTimeout(this._scanAnalysisTimer);
        this._activeScanRequestId = null;
        this._activeDuplicateRequestId = null;
        this._activeComposerRequestId = null;
        if (clearCache) this._scanCache.clear();
    },

    _scanCacheKey(row) {
        const relevantFields = [this.titleField, this.composerField, this.genreField, this.tagsField].filter(Boolean);
        const values = relevantFields.map(field => String(row[field] ?? ''));
        return JSON.stringify([this.settings?.version || 0, this._settingsRevision, relevantFields, values]);
    },

    scheduleScanAnalysis() {
        this.invalidateAnalysis();
        clearTimeout(this._scanAnalysisTimer);
        this.analysisState = { status: 'pending', message: 'Analyzing library on this device…' };
        this.updateAnalysisState?.();
        this._scanAnalysisTimer = setTimeout(() => this.requestScanAnalysis(), 25);
    },

    async requestScanAnalysis() {
        const generation = this._analysisGeneration;
        const cached = [];
        const missingIds = [];
        for (const row of this.data) {
            const id = getRowId(row);
            const key = this._scanCacheKey(row);
            const entry = this._scanCache.get(id);
            if (entry?.key === key) cached.push(entry.value);
            else missingIds.push(id);
        }

        const localRequestId = ++this._scanRequestSequence;
        this._activeScanRequestId = localRequestId;
        let fresh = [];
        if (missingIds.length > 0) {
            const response = await this._postAnalysisRequest('scan', {
                rows: this._serializeAnalysisRows(missingIds),
                headers: [...this.headers],
                settings: this.settings,
                settingsRevision: this._settingsRevision
            });
            if (generation !== this._analysisGeneration || localRequestId !== this._activeScanRequestId) {
                return { ok: false, code: 'STALE_ANALYSIS', message: 'A newer analysis request replaced this one.' };
            }
            if (!response.ok) {
                this.analysisState = { status: 'unavailable', message: response.message };
                this.updateAnalysisState?.();
                return response;
            }
            fresh = response.result;
            for (const value of fresh) {
                const row = this.dataById.get(value.id);
                if (row) this._scanCache.set(value.id, { key: this._scanCacheKey(row), value });
            }
        }

        if (generation !== this._analysisGeneration || localRequestId !== this._activeScanRequestId) {
            return { ok: false, code: 'STALE_ANALYSIS', message: 'A newer analysis request replaced this one.' };
        }
        this.scanResults = combineScanResults([...cached, ...fresh]);
        this.analysisState = { status: 'available', message: '' };
        this.updateScanResults();
        this.updateAnalysisState?.();
        return { ok: true, result: this.scanResults };
    },

    async requestDuplicateAnalysis(targetIds, pairBudget) {
        const generation = this._analysisGeneration;
        const localRequestId = ++this._duplicateRequestSequence;
        this._activeDuplicateRequestId = localRequestId;
        const response = await this._postAnalysisRequest('duplicates', {
            rows: this._serializeAnalysisRows(targetIds),
            headers: [...this.headers],
            settings: this.settings,
            pairBudget
        }, { channel: 'interactive' });
        if (generation !== this._analysisGeneration || localRequestId !== this._activeDuplicateRequestId) {
            return { ok: false, code: 'STALE_ANALYSIS', message: 'A newer analysis request replaced this one.' };
        }
        return response;
    },

    async requestComposerExtraction(targetIds) {
        const generation = this._analysisGeneration;
        const localRequestId = ++this._composerRequestSequence;
        this._activeComposerRequestId = localRequestId;
        const response = await this._postAnalysisRequest('composerExtraction', {
            rows: this._serializeAnalysisRows(targetIds),
            headers: [...this.headers],
            settings: this.settings,
            settingsRevision: this._settingsRevision
        }, { channel: 'interactive' });
        if (generation !== this._analysisGeneration || localRequestId !== this._activeComposerRequestId) {
            return { ok: false, code: 'STALE_ANALYSIS', message: 'A newer analysis request replaced this one.' };
        }
        return response;
    },

    retryAnalysis() {
        this._analysisWorker?.terminate?.();
        this._analysisWorker = null;
        this._interactiveAnalysisWorker?.terminate?.();
        this._interactiveAnalysisWorker = null;
        this.analysisState = { status: 'pending', message: 'Retrying on-device analysis…' };
        this.updateAnalysisState?.();
        return this.requestScanAnalysis();
    },

    updateAnalysisState() {
        const status = document.getElementById('analysisStatus');
        const retry = document.getElementById('analysisRetry');
        if (!status || !retry) return;
        const unavailable = this.analysisState.status === 'unavailable';
        status.textContent = this.analysisState.message || '';
        status.classList.toggle('hidden', this.analysisState.status === 'available');
        status.setAttribute('data-state', this.analysisState.status);
        retry.classList.toggle('hidden', !unavailable);
        document.querySelectorAll('.scan-fix-btn').forEach(button => { button.disabled = unavailable; });
    }
};
