import { SETTINGS_VERSION, DEFAULT_SETTINGS } from '../data/settings-defaults.js';
import { baseState } from '../core/state.js';
import { databaseState } from '../data/databases.js';

const app = {
    ...baseState,
    ...databaseState,

    _deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    _isPlainObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    },

    _deepMerge(base, override) {
        if (!this._isPlainObject(base)) return this._deepClone(override);
        const merged = this._deepClone(base);
        if (!this._isPlainObject(override)) return merged;

        Object.keys(override).forEach(key => {
            const sourceVal = override[key];
            if (Array.isArray(sourceVal)) {
                merged[key] = sourceVal.slice();
            } else if (this._isPlainObject(sourceVal) && this._isPlainObject(merged[key])) {
                merged[key] = this._deepMerge(merged[key], sourceVal);
            } else {
                merged[key] = sourceVal;
            }
        });

        return merged;
    },

    _normalizeComposerAliasKey(value) {
        return (value || '').toString().toLowerCase().trim();
    },

    _stripDiacritics(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    },

    escapeHtml(str) {
        if (str == null) return '';
        return str.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    _sanitizeSettings(input) {
        const merged = this._deepMerge(DEFAULT_SETTINGS, input || {});
        merged.version = SETTINGS_VERSION;

        const format = merged.composer?.nameDisplayFormat;
        if (!['last_first', 'first_last', 'preserve'].includes(format)) {
            merged.composer.nameDisplayFormat = DEFAULT_SETTINGS.composer.nameDisplayFormat;
        }

        const mode = merged.composer?.library?.mode;
        if (!['builtin', 'builtin_plus_custom'].includes(mode)) {
            merged.composer.library.mode = DEFAULT_SETTINGS.composer.library.mode;
        }

        const customAliases = {};
        const rawAliases = merged.composer?.library?.customAliases;
        if (rawAliases && typeof rawAliases === 'object' && !Array.isArray(rawAliases)) {
            Object.entries(rawAliases).forEach(([key, canonical]) => {
                const normalizedKey = this._normalizeComposerAliasKey(key);
                const cleanedCanonical = (canonical || '').toString().trim();
                if (normalizedKey && cleanedCanonical) {
                    customAliases[normalizedKey] = cleanedCanonical;
                }
            });
        }
        merged.composer.library.customAliases = customAliases;

        const rawBlacklist = merged.composer?.library?.blacklistedAliases;
        const blacklist = Array.isArray(rawBlacklist)
            ? [...new Set(rawBlacklist.map(a => this._normalizeComposerAliasKey(a)).filter(Boolean))]
            : [];
        merged.composer.library.blacklistedAliases = blacklist;

        const opusStyle = merged.normalization?.opusStyle;
        if (!['op', 'opus', 'preserve'].includes(opusStyle)) {
            merged.normalization.opusStyle = DEFAULT_SETTINGS.normalization.opusStyle;
        }

        return merged;
    },

    _migrateSettings(rawSettings) {
        const source = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
        const version = Number.isInteger(source.version) ? source.version : 0;

        // v0 -> v1: establish first formal schema
        if (version < 1) {
            return {
                version: 1,
                composer: {
                    nameDisplayFormat: source.composer?.nameDisplayFormat || DEFAULT_SETTINGS.composer.nameDisplayFormat,
                    library: {
                        mode: source.composer?.library?.mode || DEFAULT_SETTINGS.composer.library.mode,
                        customAliases: source.composer?.library?.customAliases || {},
                        blacklistedAliases: source.composer?.library?.blacklistedAliases || []
                    }
                },
                normalization: {
                    opusStyle: source.normalization?.opusStyle || DEFAULT_SETTINGS.normalization.opusStyle
                }
            };
        }

        return source;
    },

    loadSettings() {
        try {
            const raw = localStorage.getItem(this.settingsStorageKey);
            if (!raw) {
                this.settings = this._deepClone(DEFAULT_SETTINGS);
                return this.settings;
            }

            const parsed = JSON.parse(raw);
            const migrated = this._migrateSettings(parsed);
            const sanitized = this._sanitizeSettings(migrated);
            this.settings = sanitized;

            if (JSON.stringify(parsed) !== JSON.stringify(sanitized)) {
                localStorage.setItem(this.settingsStorageKey, JSON.stringify(sanitized));
            }

            return this.settings;
        } catch (e) {
            this.settings = this._deepClone(DEFAULT_SETTINGS);
            return this.settings;
        }
    },

    saveSettings(patch = {}) {
        const current = this.settings || this._deepClone(DEFAULT_SETTINGS);
        const next = this._sanitizeSettings(this._deepMerge(current, patch));
        this.settings = next;
        try {
            localStorage.setItem(this.settingsStorageKey, JSON.stringify(next));
        } catch (e) {}
        return this.settings;
    },

    openSettingsModal() {
        const settings = this.settings || this.loadSettings();
        document.getElementById('settingsComposerNameDisplayFormat').value = settings.composer?.nameDisplayFormat || 'last_first';
        document.getElementById('settingsComposerLibraryMode').value = settings.composer?.library?.mode || 'builtin_plus_custom';
        this.renderComposerAliasRows(settings.composer?.library?.customAliases || {});
        this.renderComposerBlacklistRows(settings.composer?.library?.blacklistedAliases || []);
        this._setSettingsComposerWarnings([]);
        const cancelBtn = document.getElementById('settingsCancelBtn');
        if (cancelBtn) cancelBtn.textContent = 'Cancel';
        document.getElementById('settingsModal').classList.add('active');
    },

    closeSettingsModal() {
        document.getElementById('settingsModal').classList.remove('active');
    },

    _setSettingsComposerWarnings(messages = []) {
        const box = document.getElementById('settingsComposerWarnings');
        if (!box) return;

        const cleaned = messages.filter(Boolean);
        if (cleaned.length === 0) {
            box.style.display = 'none';
            box.textContent = '';
            return;
        }

        box.style.display = 'block';
        box.textContent = cleaned.join('\n');
    },

    _createComposerAliasRow(key = '', canonical = '') {
        const row = document.createElement('div');
        row.className = 'settings-kv-row';

        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.className = 'form-input settings-alias-key';
        keyInput.placeholder = 'Alias key (e.g. beeth.)';
        keyInput.value = this._normalizeComposerAliasKey(key);

        const canonicalInput = document.createElement('input');
        canonicalInput.type = 'text';
        canonicalInput.className = 'form-input settings-alias-canonical';
        canonicalInput.placeholder = 'Canonical composer (e.g. Beethoven, Ludwig van)';
        canonicalInput.value = (canonical || '').toString().trim();

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'settings-remove-btn';
        removeBtn.setAttribute('aria-label', 'Remove alias mapping');
        removeBtn.textContent = '✕';

        row.appendChild(keyInput);
        row.appendChild(canonicalInput);
        row.appendChild(removeBtn);

        keyInput.addEventListener('blur', () => {
            keyInput.value = this._normalizeComposerAliasKey(keyInput.value);
        });
        removeBtn.addEventListener('click', () => row.remove());

        return row;
    },

    _createComposerBlacklistRow(value = '') {
        const row = document.createElement('div');
        row.className = 'settings-kv-row';

        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'form-input settings-blacklist-value';
        valueInput.placeholder = 'Alias value to suppress';
        valueInput.value = this._normalizeComposerAliasKey(value);
        valueInput.style.gridColumn = '1 / span 2';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'settings-remove-btn';
        removeBtn.setAttribute('aria-label', 'Remove blacklist entry');
        removeBtn.textContent = '✕';

        row.appendChild(valueInput);
        row.appendChild(removeBtn);

        valueInput.addEventListener('blur', () => {
            valueInput.value = this._normalizeComposerAliasKey(valueInput.value);
        });
        removeBtn.addEventListener('click', () => row.remove());

        return row;
    },

    renderComposerAliasRows(aliases = {}) {
        const container = document.getElementById('settingsAliasTable');
        if (!container) return;
        container.innerHTML = '';

        const entries = Object.entries(aliases);
        if (entries.length === 0) {
            container.appendChild(this._createComposerAliasRow('', ''));
            return;
        }

        entries.forEach(([key, canonical]) => {
            container.appendChild(this._createComposerAliasRow(key, canonical));
        });
    },

    renderComposerBlacklistRows(values = []) {
        const container = document.getElementById('settingsBlacklistTable');
        if (!container) return;
        container.innerHTML = '';

        if (!values.length) {
            container.appendChild(this._createComposerBlacklistRow(''));
            return;
        }

        values.forEach(value => {
            container.appendChild(this._createComposerBlacklistRow(value));
        });
    },

    addComposerAliasRow() {
        const container = document.getElementById('settingsAliasTable');
        if (!container) return;
        container.appendChild(this._createComposerAliasRow('', ''));
    },

    addComposerBlacklistRow() {
        const container = document.getElementById('settingsBlacklistTable');
        if (!container) return;
        container.appendChild(this._createComposerBlacklistRow(''));
    },

    _collectComposerLibrarySettingsFromModal() {
        const aliasRows = [...document.querySelectorAll('#settingsAliasTable .settings-kv-row')];
        const blacklistRows = [...document.querySelectorAll('#settingsBlacklistTable .settings-kv-row')];

        const customAliases = {};
        const blacklistedAliases = [];
        const blockingErrors = [];

        aliasRows.forEach((row, idx) => {
            const rawKey = row.querySelector('.settings-alias-key')?.value || '';
            const rawCanonical = row.querySelector('.settings-alias-canonical')?.value || '';
            const key = this._normalizeComposerAliasKey(rawKey);
            const canonical = rawCanonical.toString().trim();
            const isEmptyRow = !rawKey.trim() && !rawCanonical.trim();
            if (isEmptyRow) return;

            if (!key) {
                blockingErrors.push(`Alias row ${idx + 1}: alias key cannot be empty.`);
                return;
            }
            if (!canonical) {
                blockingErrors.push(`Alias row ${idx + 1}: canonical composer cannot be empty.`);
                return;
            }

            customAliases[key] = canonical;
        });

        blacklistRows.forEach((row, idx) => {
            const rawValue = row.querySelector('.settings-blacklist-value')?.value || '';
            const normalized = this._normalizeComposerAliasKey(rawValue);
            if (!rawValue.trim()) return;
            if (!normalized) {
                blockingErrors.push(`Blacklist row ${idx + 1}: alias value cannot be empty.`);
                return;
            }
            blacklistedAliases.push(normalized);
        });

        const dedupedBlacklist = [...new Set(blacklistedAliases)];
        const collisionKeys = Object.keys(customAliases).filter(key => Object.prototype.hasOwnProperty.call(this.builtInComposerDatabase, key));
        const warnings = collisionKeys.length
            ? [`Warning: ${collisionKeys.length} custom alias${collisionKeys.length !== 1 ? 'es' : ''} override built-in keys: ${collisionKeys.join(', ')}`]
            : [];

        return {
            customAliases,
            blacklistedAliases: dedupedBlacklist,
            blockingErrors,
            warnings
        };
    },

    saveSettingsFromModal() {
        const composerLibraryDraft = this._collectComposerLibrarySettingsFromModal();
        if (composerLibraryDraft.blockingErrors.length) {
            this._setSettingsComposerWarnings(composerLibraryDraft.blockingErrors);
            this.showNotification('Could not save settings. Resolve composer library validation errors.');
            return;
        }

        const patch = {
            composer: {
                nameDisplayFormat: document.getElementById('settingsComposerNameDisplayFormat').value,
                library: {
                    mode: document.getElementById('settingsComposerLibraryMode').value,
                    customAliases: composerLibraryDraft.customAliases,
                    blacklistedAliases: composerLibraryDraft.blacklistedAliases
                }
            }
        };

        this.saveSettings(patch);
        this.updateComposerToolDescriptions();
        this._setSettingsComposerWarnings(composerLibraryDraft.warnings);
        if (composerLibraryDraft.warnings.length) {
            const cancelBtn = document.getElementById('settingsCancelBtn');
            if (cancelBtn) cancelBtn.textContent = 'Close';
            this.showNotification('Settings saved with composer alias collision warnings.');
            return;
        }
        this.closeSettingsModal();
        this.showNotification('Settings saved. New tools will use the updated preferences immediately.');
    },

    resetComposerSettingsToDefaults() {
        const confirmed = window.confirm('Reset composer settings to defaults? This keeps unrelated settings (like normalization) unchanged.');
        if (!confirmed) return;

        const patch = {
            composer: {
                nameDisplayFormat: DEFAULT_SETTINGS.composer.nameDisplayFormat,
                library: {
                    mode: DEFAULT_SETTINGS.composer.library.mode,
                    customAliases: this._deepClone(DEFAULT_SETTINGS.composer.library.customAliases),
                    blacklistedAliases: this._deepClone(DEFAULT_SETTINGS.composer.library.blacklistedAliases)
                }
            }
        };

        const next = this.saveSettings(patch);
        this.updateComposerToolDescriptions();
        document.getElementById('settingsComposerNameDisplayFormat').value = next.composer?.nameDisplayFormat || DEFAULT_SETTINGS.composer.nameDisplayFormat;
        document.getElementById('settingsComposerLibraryMode').value = next.composer?.library?.mode || DEFAULT_SETTINGS.composer.library.mode;
        this.renderComposerAliasRows(next.composer?.library?.customAliases || {});
        this.renderComposerBlacklistRows(next.composer?.library?.blacklistedAliases || []);
        this._setSettingsComposerWarnings([]);
        this.showNotification('Composer settings reset to defaults.');
    },

    getComposerAliasMap() {
        const settings = this.settings || DEFAULT_SETTINGS;
        const mode = settings.composer?.library?.mode || 'builtin_plus_custom';
        const customAliases = settings.composer?.library?.customAliases || {};
        const blacklist = new Set(settings.composer?.library?.blacklistedAliases || []);

        let aliases = {};
        if (mode !== 'builtin') {
            aliases = this._deepMerge(this.builtInComposerDatabase, customAliases);
        } else {
            aliases = this._deepClone(this.builtInComposerDatabase);
        }

        blacklist.forEach(alias => {
            delete aliases[alias];
        });

        return aliases;
    },

    parseComposerName(value) {
        const raw = (value || '').toString().trim();
        if (!raw) {
            return { raw: '', first: '', last: '' };
        }

        if (raw.includes(',')) {
            const [lastPart, ...firstParts] = raw.split(',');
            return {
                raw,
                last: (lastPart || '').trim(),
                first: firstParts.join(',').trim()
            };
        }

        const parts = raw.split(/\s+/).filter(Boolean);
        if (parts.length === 1) {
            return { raw, first: '', last: parts[0] };
        }

        const last = parts.pop();
        return {
            raw,
            first: parts.join(' ').trim(),
            last: (last || '').trim()
        };
    },

    formatComposerName(value, mode = null) {
        const composer = this.parseComposerName(value);
        if (!composer.raw) return '';

        const selectedMode = mode || this.settings?.composer?.nameDisplayFormat || 'last_first';
        const formatters = {
            last_first: (c) => c.first ? `${c.last}, ${c.first}` : c.last,
            first_last: (c) => c.first ? `${c.first} ${c.last}` : c.last,
            preserve: (c) => c.raw
        };

        const formatter = formatters[selectedMode] || formatters.last_first;
        return formatter(composer).trim();
    },

    getComposerFormatLabel(mode = null) {
        const selectedMode = mode || this.settings?.composer?.nameDisplayFormat || 'last_first';
        const labels = {
            last_first: 'Last, First',
            first_last: 'First Last',
            preserve: 'preserve existing'
        };
        return labels[selectedMode] || labels.last_first;
    },

    updateComposerToolDescriptions() {
        const standardizeDesc = document.getElementById('standardizeToolDesc');
        if (!standardizeDesc) return;

        const mode = this.settings?.composer?.nameDisplayFormat || 'last_first';
        if (mode === 'preserve') {
            standardizeDesc.textContent = 'Normalize spacing and punctuation while preserving current name order';
            return;
        }

        const label = this.getComposerFormatLabel(mode);
        standardizeDesc.textContent = `Apply ${label} name format to composers`;
    },

    init() {
        this.loadSettings();
        this.updateComposerToolDescriptions();
        this.initializeCounterSync();
        this.renderGlobalCleanedCount();
        this.fetchGlobalCleanedCount();
        this.flushCounterQueue();

        // Restore saved theme
        try {
            const saved = localStorage.getItem('tidyscore-theme');
            if (saved !== 'light') {
                document.documentElement.setAttribute('data-theme', 'dark');
                document.querySelector('.theme-icon--light').style.display = 'none';
                document.querySelector('.theme-icon--dark').style.display = '';
            }
        } catch(e) {}

        const uploadSection = document.getElementById('uploadSection');
        const fileInput = document.getElementById('fileInput');

        uploadSection.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFile(e.target.files[0]));

        // Drag and drop
        uploadSection.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadSection.classList.add('dragover');
        });

        uploadSection.addEventListener('dragleave', () => {
            uploadSection.classList.remove('dragover');
        });

        uploadSection.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadSection.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        });

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterTable(e.target.value);
            const clearBtn = document.getElementById('searchClear');
            clearBtn.classList.toggle('hidden', !e.target.value);
        });

        // Warn before closing with unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.modifiedCount > 0) { e.preventDefault(); }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl+Z for undo (but not when editing a cell)
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.target.classList.contains('editing')) {
                e.preventDefault();
                this.undo();
                return;
            }
            // Cmd/Ctrl+F to focus the search input
            if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !e.target.classList.contains('editing')) {
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    e.preventDefault();
                    searchInput.focus();
                    searchInput.select();
                }
                return;
            }
            // Escape to close the topmost active modal
            if (e.key === 'Escape') {
                const openModals = [...document.querySelectorAll('.modal.active')];
                if (openModals.length > 0) {
                    openModals[openModals.length - 1].classList.remove('active');
                }
            }
        });
    },


    // Ambiguous single-word aliases that are common English words.
    // These require stronger evidence (full segment, parenthesized, or "by" attribution)
    // to avoid false positives like "Barber of Seville" → Samuel Barber.
    _ambiguousAliases: new Set([
        'glass', 'cage', 'monk', 'reich', 'barber',
        'weber', 'adams', 'davis', 'williams', 'parker', 'holst'
    ]),
















    logChange(category, count) {
        const existing = this.changeLog.find(c => c.category === category);
        if (existing) {
            existing.count += count;
        } else {
            this.changeLog.push({ category, count });
        }

        if (Number.isFinite(count) && count > 0) {
            this.enqueueCounterIncrement(count);
        }
    },

    initializeCounterSync() {
        const runtimeConfig = (typeof window !== 'undefined' && window.TIDYSCORE_CONFIG) ? window.TIDYSCORE_CONFIG : {};
        if (runtimeConfig.counterApiBaseUrl) {
            this.counterConfig.apiBaseUrl = String(runtimeConfig.counterApiBaseUrl).trim();
        }

        this.sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

        const configuredClientId = runtimeConfig.anonymousClientId ? String(runtimeConfig.anonymousClientId).trim() : '';
        if (configuredClientId) {
            this.anonymousClientId = configuredClientId;
        } else {
            const clientStorageKey = this.counterConfig.storageKeys.clientId;
            let storedClientId = '';
            try {
                storedClientId = localStorage.getItem(clientStorageKey) || '';
            } catch (error) {
                storedClientId = '';
            }

            if (!storedClientId) {
                storedClientId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
                try {
                    localStorage.setItem(clientStorageKey, storedClientId);
                } catch (error) {}
            }
            this.anonymousClientId = storedClientId;
        }

        this.loadCounterQueueFromStorage();

        if (!this.isCounterApiConfigured()) {
            try {
                const stored = localStorage.getItem(this.counterConfig.storageKeys.localTotal);
                const parsed = Number(stored);
                this.globalCleanedCount = (Number.isFinite(parsed) && parsed >= 0) ? parsed : 0;
            } catch (e) {
                this.globalCleanedCount = 0;
            }
        }
    },

    buildCounterUrl(path) {
        const base = (this.counterConfig.apiBaseUrl || '').trim().replace(/\/$/, '');
        const endpoint = path.startsWith('/') ? path : `/${path}`;
        return `${base}${endpoint}`;
    },

    isCounterApiConfigured() {
        return !!this.counterConfig.apiBaseUrl;
    },

    renderGlobalCleanedCount() {
        const valueEl = document.getElementById('globalCleanedCountValue');
        if (!valueEl) return;

        if (!Number.isFinite(this.globalCleanedCount)) {
            valueEl.textContent = '—';
            return;
        }

        valueEl.textContent = this.globalCleanedCount.toLocaleString();
    },

    setCounterSyncStatus(isOnline) {
        this.counterSyncOnline = !!isOnline;
        const statusEl = document.getElementById('counterSyncStatus');
        if (!statusEl) return;
        if (!this.isCounterApiConfigured()) {
            statusEl.hidden = true;
            return;
        }
        statusEl.hidden = this.counterSyncOnline;
    },

    async fetchGlobalCleanedCount() {
        if (!this.isCounterApiConfigured()) return;
        try {
            const response = await fetch(this.buildCounterUrl(this.counterConfig.totalEndpoint), {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            const total = Number(data?.total ?? data?.count ?? data?.value);
            if (Number.isFinite(total) && total >= 0) {
                this.globalCleanedCount = total;
                this.renderGlobalCleanedCount();
            }
            this.setCounterSyncStatus(true);
        } catch (error) {
            this.setCounterSyncStatus(false);
        }
    },

    loadCounterQueueFromStorage() {
        const queueStorageKey = this.counterConfig.storageKeys.pendingQueue;
        try {
            const raw = localStorage.getItem(queueStorageKey);
            const parsed = raw ? JSON.parse(raw) : [];
            if (Array.isArray(parsed)) {
                this.counterPendingQueue = parsed
                    .filter(item => item && Number.isFinite(Number(item.delta)) && Number(item.delta) > 0)
                    .slice(-this.counterConfig.maxPendingQueue)
                    .map(item => ({
                        delta: Number(item.delta),
                        clientId: item.clientId || this.anonymousClientId,
                        sessionId: item.sessionId || this.sessionId,
                        ts: item.ts || Date.now()
                    }));
            }
        } catch (error) {
            this.counterPendingQueue = [];
        }
    },

    persistCounterQueue() {
        const queueStorageKey = this.counterConfig.storageKeys.pendingQueue;
        const trimmed = this.counterPendingQueue.slice(-this.counterConfig.maxPendingQueue);
        this.counterPendingQueue = trimmed;
        try {
            localStorage.setItem(queueStorageKey, JSON.stringify(trimmed));
        } catch (error) {}
    },

    enqueueCounterIncrement(delta) {
        if (!this.isCounterApiConfigured()) {
            if (!Number.isFinite(this.globalCleanedCount)) this.globalCleanedCount = 0;
            this.globalCleanedCount += delta;
            try {
                localStorage.setItem(
                    this.counterConfig.storageKeys.localTotal,
                    String(this.globalCleanedCount)
                );
            } catch (e) {}
            this.renderGlobalCleanedCount();
            return;
        }
        this.counterPendingQueue.push({
            delta,
            clientId: this.anonymousClientId,
            sessionId: this.sessionId,
            ts: Date.now()
        });
        this.persistCounterQueue();
        this.scheduleCounterFlush();
    },

    scheduleCounterFlush() {
        if (this._counterFlushTimer) clearTimeout(this._counterFlushTimer);
        this._counterFlushTimer = setTimeout(() => {
            this._counterFlushTimer = null;
            this.flushCounterQueue();
        }, 700);
    },

    async flushCounterQueue() {
        if (!this.isCounterApiConfigured()) return;
        if (this._counterFlushInFlight || this.counterPendingQueue.length === 0) return;
        this._counterFlushInFlight = true;

        try {
            while (this.counterPendingQueue.length > 0) {
                const payload = this.counterPendingQueue[0];
                const response = await fetch(this.buildCounterUrl(this.counterConfig.incrementEndpoint), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                this.counterPendingQueue.shift();
                this.persistCounterQueue();
                this.setCounterSyncStatus(true);

                const newTotal = this.globalCleanedCount;
                if (Number.isFinite(newTotal)) {
                    this.globalCleanedCount = newTotal + Number(payload.delta || 0);
                    this.renderGlobalCleanedCount();
                }
            }
        } catch (error) {
            this.setCounterSyncStatus(false);
            this.persistCounterQueue();
        } finally {
            this._counterFlushInFlight = false;
        }
    },

    pushUndo(label) {
        this.undoStack.push({
            data: JSON.parse(JSON.stringify(this.data)),
            modifiedCount: this.modifiedCount,
            changeLog: JSON.parse(JSON.stringify(this.changeLog)),
            label
        });
        if (this.undoStack.length > 50) this.undoStack.shift();
        this.updateUndoButton();
    },

    undo() {
        if (this.undoStack.length === 0) return;
        const snapshot = this.undoStack.pop();
        this.data = snapshot.data;
        this.dataById = new Map(this.data.map(row => [row.__id, row]));
        this.modifiedCount = snapshot.modifiedCount;
        this.changeLog = snapshot.changeLog;
        this.analyzeData();
        this.renderAll();
        this.updateUndoButton();
        this.showNotification(`Undid "${snapshot.label}"`);
    },

    updateUndoButton() {
        const btn = document.getElementById('undoBtn');
        if (!btn) return;
        const label = btn.querySelector('.btn-tool-label');
        if (this.undoStack.length === 0) {
            btn.disabled = true;
            if (label) label.textContent = 'Undo';
        } else {
            btn.disabled = false;
            const lastLabel = this.undoStack[this.undoStack.length - 1].label;
            if (label) label.textContent = `Undo ${lastLabel}`;
        }
    },





    // ===== Shared Preview Modal =====

    // ===== Genre & Tag Tools =====




    // --- Suggest Genre from Composer ---








    // --- Suggest Tags from Titles ---








    // --- Genre/Tag Manager ---

    managerTab: 'genres',
    managerData: [],
    managerSelectedValues: new Set(),
    managerFilterText: '',

















    toggleDiffView() {
        const toggle = document.getElementById('diffToggle');
        const container = document.getElementById('diffContainer');

        if (container.style.display === 'none') {
            toggle.classList.add('expanded');
            document.getElementById('diffToggleLabel').textContent = `Hide changes (${this._exportDiffs.length})`;

            const maxShow = 200;
            const diffs = this._exportDiffs;
            const toShow = diffs.slice(0, maxShow);

            let html = '';
            toShow.forEach(d => {
                const oldEsc = this.escapeHtml(d.oldVal || '');
                const newEsc = this.escapeHtml(d.newVal || '');
                html += `<div class="diff-row">
                    <div class="diff-row-header">
                        <span class="diff-row-num">Row ${d.rowNum}</span>
                        <span class="diff-field">${this.escapeHtml(d.field)}</span>
                    </div>
                    <span class="diff-old">${oldEsc || '(empty)'}</span>
                    <span class="diff-arrow">&rarr;</span>
                    <span class="diff-new">${newEsc || '(empty)'}</span>
                </div>`;
            });

            if (diffs.length > maxShow) {
                html += `<div class="diff-row" style="text-align:center;color:var(--color-text-muted);">
                    &hellip; and ${diffs.length - maxShow} more changes
                </div>`;
            }

            container.innerHTML = html;
            container.style.display = '';
        } else {
            toggle.classList.remove('expanded');
            document.getElementById('diffToggleLabel').textContent = `Show all changes (${this._exportDiffs.length})`;
            container.style.display = 'none';
        }
    },

    toggleTheme() {
        const html = document.documentElement;
        const isDark = html.getAttribute('data-theme') === 'dark';
        html.setAttribute('data-theme', isDark ? 'light' : 'dark');
        document.querySelector('.theme-icon--light').style.display = isDark ? '' : 'none';
        document.querySelector('.theme-icon--dark').style.display = isDark ? 'none' : '';
        try { localStorage.setItem('tidyscore-theme', isDark ? 'light' : 'dark'); } catch(e) {}
    },

    // ===== Duplicate Detection =====

};

export default app;
