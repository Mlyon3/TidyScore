import { csvCore } from './core/csv.js';
import { tableUi } from './ui/table.js';
import { modalUi } from './ui/modals.js';
import { composerTools } from './tools/composer-tools.js';
import { tagTools } from './tools/tag-tools.js';
import { duplicateTools } from './tools/duplicate-tools.js';
import { accessibilityUi } from './ui/accessibility.js';
import { sessionCore } from './core/session.js';
import { analysisClient } from './core/analysis-client.js';
import { pwaUi } from './ui/pwa.js';

import { DEFAULT_SETTINGS } from './data/settings-defaults.js';
import { createBaseState } from './core/state.js';
import { buildRowsById, cloneRowsWithIds } from './domain/row-identity.js';
import { createLibrary } from './domain/library.js';
import { buildComposerAliasMap, normalizeComposerValue } from './domain/composers.js';
import {
    deepClone,
    deepMerge,
    loadSettingsFromJson,
    sanitizeSettings,
    validateComposerLibraryDraft
} from './domain/settings.js';
import { normalizeAliasKey } from './domain/text.js';

const appMethods = {
    escapeHtml(str) {
        if (str == null) return '';
        return str.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    loadSettings() {
        let raw = null;
        try {
            raw = localStorage.getItem(this.settingsStorageKey);
        } catch (_) {
            // Settings persistence is optional.
        }
        const { settings, changed } = loadSettingsFromJson(raw);
        this.settings = settings;
        if (changed) this._persistSettings();
        return this.settings;
    },

    _persistSettings() {
        try {
            localStorage.setItem(this.settingsStorageKey, JSON.stringify(this.settings));
        } catch (_) {
            // Settings persistence is optional.
        }
    },

    saveSettings(patch = {}) {
        this.settings = sanitizeSettings(deepMerge(this.settings || DEFAULT_SETTINGS, patch));
        this._settingsRevision++;
        this.invalidateAnalysis?.({ clearCache: true });
        this._persistSettings();
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
        keyInput.value = normalizeAliasKey(key);

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
            keyInput.value = normalizeAliasKey(keyInput.value);
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
        valueInput.value = normalizeAliasKey(value);
        valueInput.style.gridColumn = '1 / span 2';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'settings-remove-btn';
        removeBtn.setAttribute('aria-label', 'Remove blacklist entry');
        removeBtn.textContent = '✕';

        row.appendChild(valueInput);
        row.appendChild(removeBtn);

        valueInput.addEventListener('blur', () => {
            valueInput.value = normalizeAliasKey(valueInput.value);
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
        const aliasRows = [...document.querySelectorAll('#settingsAliasTable .settings-kv-row')].map(row => ({
            key: row.querySelector('.settings-alias-key')?.value || '',
            canonical: row.querySelector('.settings-alias-canonical')?.value || ''
        }));
        const blacklistValues = [...document.querySelectorAll('#settingsBlacklistTable .settings-kv-row')]
            .map(row => row.querySelector('.settings-blacklist-value')?.value || '');
        return validateComposerLibraryDraft(aliasRows, blacklistValues);
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
                    customAliases: deepClone(DEFAULT_SETTINGS.composer.library.customAliases),
                    blacklistedAliases: deepClone(DEFAULT_SETTINGS.composer.library.blacklistedAliases)
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

    // Cached per settings object; saveSettings() replaces the object, which invalidates it.
    getComposerAliasMap() {
        const settings = this.settings || DEFAULT_SETTINGS;
        if (this._aliasMapCache?.settings !== settings) {
            this._aliasMapCache = { settings, aliasMap: buildComposerAliasMap(settings) };
        }
        return this._aliasMapCache.aliasMap;
    },

    normalizeComposerValue(value, aliasMap = null) {
        return normalizeComposerValue(value, aliasMap || this.getComposerAliasMap());
    },

    getLibrary() {
        return createLibrary({
            title: this.titleField,
            composer: this.composerField,
            genre: this.genreField,
            tags: this.tagsField,
            filename: this.filenameField
        }, this.dataById);
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
        } catch (_) {
            // Theme persistence is optional.
        }

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

    },

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

    toggleTheme() {
        const html = document.documentElement;
        const isDark = html.getAttribute('data-theme') === 'dark';
        html.setAttribute('data-theme', isDark ? 'light' : 'dark');
        document.querySelector('.theme-icon--light').style.display = isDark ? '' : 'none';
        document.querySelector('.theme-icon--dark').style.display = isDark ? 'none' : '';
        try { localStorage.setItem('tidyscore-theme', isDark ? 'light' : 'dark'); } catch (_) {
            // Theme persistence is optional.
        }
    },

};

export function createApp(options = {}) {
    const instance = Object.assign(
        createBaseState(),
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
        pwaUi,
        options
    );
    return instance;
}

const composedApp = createApp();

export default composedApp;
