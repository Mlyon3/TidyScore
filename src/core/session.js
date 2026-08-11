import { buildRowsById, rehydrateRowIds } from './row-identity.js';

const DB_NAME = 'tidyscore-local';
const STORE_NAME = 'sessions';
const SESSION_KEY = 'current';

function openDatabase() {
    return new Promise((resolve, reject) => {
        if (!globalThis.indexedDB) {
            reject(new Error('Local recovery is not supported in this browser.'));
            return;
        }

        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE_NAME)) {
                request.result.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Could not open local recovery storage.'));
    });
}

async function withStore(mode, operation) {
    const db = await openDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, mode);
            const request = operation(transaction.objectStore(STORE_NAME));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Local recovery storage failed.'));
        });
    } finally {
        db.close();
    }
}

export function saveLocalSession(session) {
    return withStore('readwrite', store => store.put(session, SESSION_KEY));
}

export function loadLocalSession() {
    return withStore('readonly', store => store.get(SESSION_KEY));
}

export function clearLocalSession() {
    return withStore('readwrite', store => store.delete(SESSION_KEY));
}

function isPlainRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function copySessionRows(rows, headers, version) {
    return rows.map(row => {
        const copy = Object.create(null);
        for (const header of headers) {
            if (version === 1 && header === '__id') continue;
            copy[header] = Object.hasOwn(row, header) ? row[header] : '';
        }
        return copy;
    });
}

function hasValidFieldValues(row, headers, version) {
    return headers.every(header =>
        (version === 1 && header === '__id') ||
        !Object.hasOwn(row, header) ||
        typeof row[header] === 'string'
    );
}

export function validateSessionPayload(session) {
    if (!isPlainRecord(session) || ![1, 2].includes(session.version)) {
        return { ok: false, code: 'INVALID_SESSION', message: 'The saved session has an unsupported format.' };
    }
    if (!Array.isArray(session.headers) || session.headers.length === 0 ||
        session.headers.some(header => typeof header !== 'string' || !header.trim()) ||
        new Set(session.headers).size !== session.headers.length) {
        return { ok: false, code: 'INVALID_SESSION', message: 'The saved session has invalid column headers.' };
    }
    if (!Array.isArray(session.data) || session.data.length === 0 ||
        session.data.some(row => !isPlainRecord(row) || !hasValidFieldValues(row, session.headers, session.version))) {
        return { ok: false, code: 'INVALID_SESSION', message: 'The saved session has invalid row data.' };
    }
    const originalData = session.originalData == null ? session.data : session.originalData;
    if (!Array.isArray(originalData) || originalData.length !== session.data.length ||
        originalData.some(row => !isPlainRecord(row) || !hasValidFieldValues(row, session.headers, session.version))) {
        return { ok: false, code: 'INVALID_SESSION', message: 'The saved session has invalid original row data.' };
    }
    if (session.changeLog != null && (!Array.isArray(session.changeLog) || session.changeLog.some(change =>
        !isPlainRecord(change) || typeof change.category !== 'string' ||
        typeof change.count !== 'number' || !Number.isFinite(change.count)
    ))) {
        return { ok: false, code: 'INVALID_SESSION', message: 'The saved session has an invalid change history.' };
    }

    const headers = session.version === 1
        ? session.headers.filter(header => header !== '__id')
        : [...session.headers];
    if (headers.length === 0) {
        return { ok: false, code: 'INVALID_SESSION', message: 'The saved session has no recoverable columns.' };
    }
    return {
        ok: true,
        value: {
            version: 2,
            sourceFileName: typeof session.sourceFileName === 'string' && session.sourceFileName
                ? session.sourceFileName
                : 'forscore-library.csv',
            headers,
            data: copySessionRows(session.data, headers, session.version),
            originalData: copySessionRows(originalData, headers, session.version),
            changeLog: JSON.parse(JSON.stringify(session.changeLog || [])),
            savedAt: typeof session.savedAt === 'string' ? session.savedAt : null
        }
    };
}

export const sessionCore = {
    loadRecoveryPreference() {
        try {
            this.recoveryEnabled = localStorage.getItem(this.recoveryPreferenceKey) === 'true';
        } catch (_) {
            this.recoveryEnabled = false;
        }
        this.updateRecoveryUi();
    },

    async checkSavedSession() {
        try {
            const session = await loadLocalSession();
            if (!session) return;
            const validation = validateSessionPayload(session);
            if (!validation.ok) {
                this.savedSession = session;
                this.savedSessionInvalid = true;
                const detail = document.getElementById('recoveryPromptDetail');
                if (detail) detail.textContent = 'The saved data is corrupt or incompatible. Delete it to continue safely.';
                document.getElementById('recoveryPrompt')?.classList.remove('hidden');
                return;
            }
            this.savedSession = session;
            this.savedSessionInvalid = false;
            const detail = document.getElementById('recoveryPromptDetail');
            if (detail) {
                const savedAt = session.savedAt ? new Date(session.savedAt).toLocaleString() : 'recently';
                detail.textContent = `${session.sourceFileName || 'forScore library'} · saved ${savedAt}`;
            }
            document.getElementById('recoveryPrompt')?.classList.remove('hidden');
        } catch (_) {
            // Recovery is optional; unsupported/private storage should not block the app.
        }
    },

    async setSessionRecovery(enabled) {
        this.recoveryEnabled = Boolean(enabled);
        try {
            localStorage.setItem(this.recoveryPreferenceKey, String(this.recoveryEnabled));
        } catch (_) {
            // Preference persistence is optional.
        }

        if (this.recoveryEnabled) {
            await this.persistSession();
            this.showNotification('Local recovery enabled for this library.');
        } else {
            await this.deleteSavedSession({ quiet: true, preservePreference: true });
            this.showNotification('Local recovery disabled and its saved copy deleted.');
        }
        this.updateRecoveryUi();
    },

    updateRecoveryUi() {
        const toggle = document.getElementById('sessionRecoveryToggle');
        if (toggle) toggle.checked = Boolean(this.recoveryEnabled);
        const deleteButton = document.getElementById('deleteSessionBtn');
        if (deleteButton) deleteButton.classList.toggle('hidden', !this.recoveryEnabled);
    },

    scheduleSessionSave() {
        if (!this.recoveryEnabled || !this.data?.length) return;
        clearTimeout(this._sessionSaveTimer);
        this._sessionSaveTimer = setTimeout(() => this.persistSession(), 250);
    },

    async persistSession() {
        if (!this.recoveryEnabled || !this.data?.length) return;
        try {
            const session = {
                version: 2,
                sourceFileName: this.sourceFileName || 'forscore-library.csv',
                headers: [...this.headers],
                data: JSON.parse(JSON.stringify(this.data)),
                originalData: JSON.parse(JSON.stringify(this.originalData)),
                changeLog: JSON.parse(JSON.stringify(this.changeLog)),
                savedAt: new Date().toISOString()
            };
            await saveLocalSession(session);
            this.savedSession = session;
            this.updateRecoveryUi();
        } catch (_) {
            this.recoveryEnabled = false;
            try { localStorage.setItem(this.recoveryPreferenceKey, 'false'); } catch (_) {
                // Preference persistence is optional.
            }
            this.updateRecoveryUi();
            this.showNotification('This browser could not save the library locally. Your open session is unchanged.');
        }
    },

    async restoreSavedSession() {
        const session = this.savedSession || await loadLocalSession();
        if (!session) {
            this.showNotification('No saved local session was found.');
            return;
        }

        const validation = validateSessionPayload(session);
        if (!validation.ok) {
            this.savedSessionInvalid = true;
            this.showNotification('The saved local session is corrupt. Delete it from the recovery prompt.');
            return;
        }
        const restored = validation.value;

        this.finishActiveCellEdit?.({ cancel: true, render: false });
        this.editGeneration = (this.editGeneration || 0) + 1;
        this._fileReadGeneration = (this._fileReadGeneration || 0) + 1;
        this._activeFileReader?.abort?.();
        this._activeFileReader = null;
        this.sourceFileName = restored.sourceFileName;
        this.headers = [...restored.headers];
        this.data = rehydrateRowIds(restored.data);
        this.originalData = rehydrateRowIds(restored.originalData);
        this.changeLog = restored.changeLog;
        this.dataById = buildRowsById(this.data);
        this.originalDataById = buildRowsById(this.originalData);
        this.scaleWarning = this.data.length > 5000
            ? { rowCount: this.data.length, validatedTarget: 5000 }
            : null;
        this.currentFilter = '';
        this.filteredIds = [];
        this.visibleIds = [];
        this.currentPage = 0;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
        document.getElementById('searchClear')?.classList.add('hidden');
        this.selectedIds.clear();
        this.undoStack = [];
        this.exportReviewCandidates = new Map();
        this.invalidateAnalysis?.({ clearCache: true });
        this.recoveryEnabled = true;
        try { localStorage.setItem(this.recoveryPreferenceKey, 'true'); } catch (_) {
            // Preference persistence is optional.
        }
        this.analyzeData();
        this.renderAll();
        document.getElementById('recoveryPrompt')?.classList.add('hidden');
        this.showNotification('Previous local session restored.');
    },

    async deleteSavedSession(options = {}) {
        try { await clearLocalSession(); } catch (_) {
            // Deletion is best effort when storage is unavailable.
        }
        this.savedSession = null;
        this.savedSessionInvalid = false;
        document.getElementById('recoveryPrompt')?.classList.add('hidden');
        if (!options.preservePreference) {
            this.recoveryEnabled = false;
            try { localStorage.setItem(this.recoveryPreferenceKey, 'false'); } catch (_) {
                // Preference persistence is optional.
            }
        }
        this.updateRecoveryUi();
        if (!options.quiet) this.showNotification('Saved local session deleted.');
    }
};
