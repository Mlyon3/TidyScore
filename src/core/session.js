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
            if (!session?.data?.length || !session?.headers?.length) return;
            this.savedSession = session;
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
        } catch (_) {}

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
                version: 1,
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
            try { localStorage.setItem(this.recoveryPreferenceKey, 'false'); } catch (_) {}
            this.updateRecoveryUi();
            this.showNotification('This browser could not save the library locally. Your open session is unchanged.');
        }
    },

    async restoreSavedSession() {
        const session = this.savedSession || await loadLocalSession();
        if (!session?.data?.length) {
            this.showNotification('No saved local session was found.');
            return;
        }

        this.sourceFileName = session.sourceFileName || 'forscore-library.csv';
        this.headers = [...session.headers];
        this.data = JSON.parse(JSON.stringify(session.data));
        this.originalData = JSON.parse(JSON.stringify(session.originalData || session.data));
        this.changeLog = JSON.parse(JSON.stringify(session.changeLog || []));
        this.dataById = new Map(this.data.map(row => [row.__id, row]));
        this.selectedIds.clear();
        this.undoStack = [];
        this.exportReviewCandidates = new Map();
        this.recoveryEnabled = true;
        try { localStorage.setItem(this.recoveryPreferenceKey, 'true'); } catch (_) {}
        this.analyzeData();
        this.renderAll();
        document.getElementById('recoveryPrompt')?.classList.add('hidden');
        this.showNotification('Previous local session restored.');
    },

    async deleteSavedSession(options = {}) {
        try { await clearLocalSession(); } catch (_) {}
        this.savedSession = null;
        document.getElementById('recoveryPrompt')?.classList.add('hidden');
        if (!options.preservePreference) {
            this.recoveryEnabled = false;
            try { localStorage.setItem(this.recoveryPreferenceKey, 'false'); } catch (_) {}
        }
        this.updateRecoveryUi();
        if (!options.quiet) this.showNotification('Saved local session deleted.');
    }
};
