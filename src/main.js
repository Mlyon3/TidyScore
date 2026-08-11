import { csvCore } from './core/csv.js';
import { tableUi } from './ui/table.js';
import { modalUi } from './ui/modals.js';
import { composerTools } from './tools/composer-tools.js';
import { tagTools } from './tools/tag-tools.js';
import { duplicateTools } from './tools/duplicate-tools.js';
import { accessibilityUi } from './ui/accessibility.js';
import { sessionCore } from './core/session.js';
import { analysisClient } from './core/analysis-client.js';

import { SETTINGS_VERSION, DEFAULT_SETTINGS } from './data/settings-defaults.js';
import { createBaseState } from './core/state.js';
import { buildRowsById, cloneRowsWithIds } from './core/row-identity.js';
import { databaseState } from './data/databases.js';

const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const appMethods = {

    _deepClone(obj) {
        if (Array.isArray(obj)) return obj.map(value => this._deepClone(value));
        if (this._isPlainObject(obj)) {
            const clone = {};
            Object.keys(obj).forEach(key => {
                if (!UNSAFE_OBJECT_KEYS.has(key)) clone[key] = this._deepClone(obj[key]);
            });
            return clone;
        }
        return obj;
    },

    _isPlainObject(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    },

    _deepMerge(base, override) {
        if (!this._isPlainObject(base)) return this._deepClone(override);
        const merged = this._deepClone(base);
        if (!this._isPlainObject(override)) return merged;

        Object.keys(override).forEach(key => {
            if (UNSAFE_OBJECT_KEYS.has(key)) return;
            const sourceVal = override[key];
            if (Array.isArray(sourceVal)) {
                merged[key] = this._deepClone(sourceVal);
            } else if (this._isPlainObject(sourceVal)) {
                merged[key] = this._deepMerge(
                    this._isPlainObject(merged[key]) ? merged[key] : {},
                    sourceVal
                );
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

        delete merged.composer.nameDisplayFormat;

        const mode = merged.composer?.library?.mode;
        if (!['builtin', 'builtin_plus_custom'].includes(mode)) {
            merged.composer.library.mode = DEFAULT_SETTINGS.composer.library.mode;
        }

        const customAliases = {};
        const rawAliases = merged.composer?.library?.customAliases;
        if (rawAliases && typeof rawAliases === 'object' && !Array.isArray(rawAliases)) {
            Object.entries(rawAliases).forEach(([key, canonical]) => {
                const normalizedKey = this._normalizeComposerAliasKey(key);
                if (UNSAFE_OBJECT_KEYS.has(normalizedKey)) return;
                let cleanedCanonical = (canonical || '').toString().trim();
                const legacyParts = cleanedCanonical.split(',').map(part => part.trim()).filter(Boolean);
                if (legacyParts.length === 2) {
                    cleanedCanonical = `${legacyParts[1]} ${legacyParts[0]}`.trim();
                }
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

        if (version < 2) {
            return {
                version: 2,
                composer: {
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
        this._settingsRevision++;
        this.invalidateAnalysis?.({ clearCache: true });
        try {
            localStorage.setItem(this.settingsStorageKey, JSON.stringify(next));
        } catch (e) {}
        if (this.data.length) this.scheduleScanAnalysis?.();
        return this.settings;
    },

    openSettingsModal() {
        const settings = this.settings || this.loadSettings();
        document.getElementById('settingsComposerLibraryMode').value = settings.composer?.library?.mode || 'builtin_plus_custom';
        this.renderComposerAliasRows(settings.composer?.library?.customAliases || {});
        this.renderComposerBlacklistRows(settings.composer?.library?.blacklistedAliases || []);
        this._setSettingsComposerWarnings([]);
        const cancelBtn = document.getElementById('settingsCancelBtn');
        if (cancelBtn) cancelBtn.textContent = 'Cancel';
        this.activateModal(document.getElementById('settingsModal'));
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
        canonicalInput.placeholder = 'Canonical composer (e.g. Ludwig van Beethoven)';
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
            if (UNSAFE_OBJECT_KEYS.has(key)) {
                blockingErrors.push(`Alias row ${idx + 1}: “${key}” is reserved and cannot be used as an alias key.`);
                return;
            }
            if (!canonical) {
                blockingErrors.push(`Alias row ${idx + 1}: canonical composer cannot be empty.`);
                return;
            }
            if (canonical.includes(',')) {
                blockingErrors.push(`Alias row ${idx + 1}: use First Last for one composer; commas separate multiple composers.`);
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
                library: {
                    mode: DEFAULT_SETTINGS.composer.library.mode,
                    customAliases: this._deepClone(DEFAULT_SETTINGS.composer.library.customAliases),
                    blacklistedAliases: this._deepClone(DEFAULT_SETTINGS.composer.library.blacklistedAliases)
                }
            }
        };

        const next = this.saveSettings(patch);
        this.updateComposerToolDescriptions();
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

    formatComposerName(value) {
        const composer = this.parseComposerName(value);
        if (!composer.raw) return '';

        return (composer.first ? `${composer.first} ${composer.last}` : composer.last).trim();
    },

    normalizeComposerValue(value, aliasMap = null) {
        const raw = (value || '').toString().trim();
        if (!raw) return { entries: [], formatted: '' };

        aliasMap = aliasMap || this.getComposerAliasMap();
        const resolveSingle = (input) => {
            const source = input.trim();
            const canonical = this.getSuggestion(source, aliasMap) || source;
            return {
                extracted: source,
                canonical,
                formatted: this.formatComposerName(canonical) || source
            };
        };

        const direct = this.getSuggestion(raw, aliasMap);
        if (direct) {
            const entry = resolveSingle(raw);
            return { entries: [entry], formatted: entry.formatted };
        }

        const commaParts = raw.split(',').map(part => part.trim()).filter(Boolean);
        if (commaParts.length === 2) {
            const legacyCandidate = `${commaParts[1]} ${commaParts[0]}`.trim();
            const legacyCanonical = this.getSuggestion(legacyCandidate, aliasMap);
            if (legacyCanonical) {
                const entry = {
                    extracted: raw,
                    canonical: legacyCanonical,
                    formatted: this.formatComposerName(legacyCanonical)
                };
                return { entries: [entry], formatted: entry.formatted };
            }
        }

        const seen = new Set();
        const entries = commaParts.map(resolveSingle).filter(entry => {
            const key = this._stripDiacritics(entry.formatted.toLowerCase());
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return {
            entries,
            formatted: entries.map(entry => entry.formatted).join(', ')
        };
    },

    updateComposerToolDescriptions() {
        const standardizeDesc = document.getElementById('standardizeToolDesc');
        if (!standardizeDesc) return;
        standardizeDesc.textContent = 'Apply First Last format to comma-separated composers';
    },

    init() {
        this.loadSettings();
        this.loadRecoveryPreference();
        this.updateComposerToolDescriptions();
        this.initializeAccessibility();
        this.checkSavedSession();

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

        document.getElementById('libraryEditor')?.addEventListener('toggle', event => {
            if (this.data.length > 0) this.updateWorkflowSteps(event.currentTarget.open ? 'edit' : 'review');
        });

        // Warn before closing with unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.refreshModificationState() > 0) { e.preventDefault(); }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            const isEditableTarget = e.target instanceof Element && Boolean(e.target.closest(
                'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'
            ));
            // Cmd/Ctrl+Z for application undo outside native editing controls.
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !isEditableTarget) {
                e.preventDefault();
                this.undo();
                return;
            }
            // Cmd/Ctrl+F to focus the search input
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && !isEditableTarget) {
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

        if (import.meta.env.PROD && 'serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`).catch(() => {});
            });
        }
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
    },

    pushUndo(label, context = null) {
        this.undoStack.push({
            data: cloneRowsWithIds(this.data),
            modifiedCount: this.modifiedCount,
            changeLog: JSON.parse(JSON.stringify(this.changeLog)),
            label,
            context
        });
        if (this.undoStack.length > 50) this.undoStack.shift();
        this.updateUndoButton();
    },

    undo() {
        if (this.undoStack.length === 0) return;
        this.finishActiveCellEdit?.({ cancel: true, render: false });
        this.editGeneration = (this.editGeneration || 0) + 1;
        const exportModalOpen = document.getElementById('exportModal')?.classList.contains('active');
        const snapshot = this.undoStack.pop();
        this.data = snapshot.data;
        this.dataById = buildRowsById(this.data);
        this.modifiedCount = snapshot.modifiedCount;
        this.changeLog = snapshot.changeLog;
        this.analyzeData();
        this.renderAll();
        this.updateUndoButton();
        if (exportModalOpen) {
            this.updateWorkflowSteps?.('return');
            this.renderExportSummary?.({ preserveScroll: true });
        }
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



export function createApp(options = {}) {
    const instance = Object.assign(
        createBaseState(),
        databaseState,
        appMethods,
        csvCore,
        tableUi,
        modalUi,
        composerTools,
        tagTools,
        duplicateTools,
        accessibilityUi,
        sessionCore,
        analysisClient,
        options
    );
    instance._ambiguousAliases = new Set(appMethods._ambiguousAliases);
    return instance;
}

const composedApp = createApp();

export default composedApp;
