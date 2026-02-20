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

    getSuggestion(composer, aliasMap = null) {
        if (!composer) return null;
        const normalized = this._normalizeComposerAliasKey(composer);
        aliasMap = aliasMap || this.getComposerAliasMap();

        // 1. Exact normalized match (current behavior)
        if (aliasMap[normalized]) return aliasMap[normalized];

        // 2. Strip diacritics from input and try direct lookup
        const strippedInput = this._stripDiacritics(normalized);
        if (strippedInput !== normalized && aliasMap[strippedInput]) {
            return aliasMap[strippedInput];
        }

        // 3. Strip diacritics from map keys and compare
        for (const key in aliasMap) {
            if (this._stripDiacritics(key) === strippedInput) {
                return aliasMap[key];
            }
        }

        return null;
    },

    // Ambiguous single-word aliases that are common English words.
    // These require stronger evidence (full segment, parenthesized, or "by" attribution)
    // to avoid false positives like "Barber of Seville" → Samuel Barber.
    _ambiguousAliases: new Set([
        'glass', 'cage', 'monk', 'reich', 'barber',
        'weber', 'adams', 'davis', 'williams', 'parker', 'holst'
    ]),

    _isAmbiguousSingleWord(candidate) {
        const words = candidate.trim().split(/\s+/);
        return words.length === 1 && this._ambiguousAliases.has(candidate.toLowerCase().trim());
    },

    _tryGetSuggestion(candidate, aliasMap, allowAmbiguous = false) {
        if (!candidate || !candidate.trim()) return null;
        const trimmed = candidate.trim();
        if (!allowAmbiguous && this._isAmbiguousSingleWord(trimmed)) return null;
        const suggestion = this.getSuggestion(trimmed, aliasMap);
        return suggestion ? { extracted: trimmed, suggestion } : null;
    },

    _containsCpeCue(text = '') {
        if (!text || !text.trim()) return false;
        return /\bc\.?\s*p\.?\s*e\.?\b|carl\s+philipp\s+emanuel/iu.test(text);
    },

    _applyBachContextOverride(suggestion, contextText = '') {
        if (suggestion === 'Bach, Johann Sebastian' && this._containsCpeCue(contextText)) {
            return 'Bach, Carl Philipp Emanuel';
        }
        return suggestion;
    },

    _extractComposerFromTitle(title, aliasMap = null) {
        if (!title || !title.trim()) return null;
        title = title.trim();
        aliasMap = aliasMap || this.getComposerAliasMap();
        const applyOverride = (result) => {
            if (!result) return null;
            return {
                ...result,
                suggestion: this._applyBachContextOverride(result.suggestion, title)
            };
        };

        // Strategy 1: Separator-based segment scanning
        // Split on spaced dashes (preserving hyphenated names), underscore, colon, pipe, slash
        const separatorPattern = /\s+[-\u2013\u2014]\s+|[_:|\/]/;
        if (separatorPattern.test(title)) {
            const segments = title.split(separatorPattern).map(s => s.trim()).filter(Boolean);

            for (const segment of segments) {
                // Try full segment first (ambiguous words OK as full segments)
                const fullResult = this._tryGetSuggestion(segment, aliasMap, true);
                if (fullResult) return applyOverride(fullResult);

                // Try progressively shorter word prefixes within segment
                const words = segment.split(/\s+/);
                for (let len = Math.min(words.length - 1, 4); len >= 1; len--) {
                    const candidate = words.slice(0, len).join(' ');
                    const result = this._tryGetSuggestion(candidate, aliasMap, false);
                    if (result) return applyOverride(result);
                }

                // Try progressively shorter word suffixes within segment
                for (let len = Math.min(words.length - 1, 4); len >= 1; len--) {
                    const candidate = words.slice(-len).join(' ');
                    const result = this._tryGetSuggestion(candidate, aliasMap, false);
                    if (result) return applyOverride(result);
                }
            }
        }

        // Strategy 2: Parenthesized content
        const parenMatches = title.match(/\(([^)]+)\)/);
        if (parenMatches) {
            const inner = parenMatches[1].trim();
            // Ambiguous words OK in parentheses (explicit attribution)
            const fullResult = this._tryGetSuggestion(inner, aliasMap, true);
            if (fullResult) return applyOverride(fullResult);

            const words = inner.split(/\s+/);
            for (let len = Math.min(words.length - 1, 4); len >= 1; len--) {
                const candidate = words.slice(0, len).join(' ');
                const result = this._tryGetSuggestion(candidate, aliasMap, true);
                if (result) return applyOverride(result);
            }
        }

        // Strategy 3: "by" keyword
        const byMatch = title.match(/\bby\s+([\p{L}][\p{L}.\s-]*?)(?:\s*[,)\u2013\u2014|]|\s*$)/iu);
        if (byMatch) {
            const candidate = byMatch[1].trim();
            // Ambiguous words OK after "by" (explicit attribution)
            const fullResult = this._tryGetSuggestion(candidate, aliasMap, true);
            if (fullResult) return applyOverride(fullResult);

            const words = candidate.split(/\s+/);
            for (let len = Math.min(words.length - 1, 4); len >= 1; len--) {
                const cand = words.slice(0, len).join(' ');
                const result = this._tryGetSuggestion(cand, aliasMap, true);
                if (result) return applyOverride(result);
            }
        }

        // Strategy 4: Structural patterns (Unicode-aware, start-anchored)
        const structuralPatterns = [
            // "Bach - Prelude" or "J.S. Bach - Air" (with Unicode letter support)
            /^([\p{Lu}][\p{Ll}]+(?:\s+[\p{Lu}]\.?\s*[\p{Lu}]\.?\s*)?(?:\s+[\p{Lu}][\p{Ll}]+)?)\s*[-\u2013\u2014]\s*/u,
            // "Dvorak_SQ12"
            /^([\p{Lu}][\p{Ll}]+)_/u,
            // "Bach Suite" or "Beethoven Sonata" (expanded form keywords)
            /^([\p{Lu}][\p{Ll}]+)\s+(?:[Ss]uite|[Ss]onata|[Ss]ymphony|[Cc]oncerto|[Qq]uartet|[Qq]uintet|[Pp]relude|[Ff]ugue|[Cc]antata|[Mm]ass|[Rr]equiem|[Oo]verture|[Rr]hapsody|[Nn]octurne|[EÉeé]tude|[Ww]altz|[Pp]olonaise|[Mm]azurka|[Bb]allade|[Ii]mpromptu|[Vv]ariations|[Ss]erenade|[Dd]ivertimento|[Tt]rio|[Oo]pus|Op\.|No\.)/u,
            // "Bach 3rd" or "Beethoven 5th"
            /^([\p{Lu}][\p{Ll}]+)\s+\d/u
        ];

        for (const pattern of structuralPatterns) {
            const match = title.match(pattern);
            if (match) {
                const potentialComposer = match[1].trim();
                const suggestion = this.getSuggestion(potentialComposer, aliasMap);
                if (suggestion) {
                    return applyOverride({ extracted: potentialComposer, suggestion });
                }
            }
        }

        // Strategy 5: Multi-word prefix scan (for titles without separators)
        const titleWords = title.split(/\s+/);
        for (let len = Math.min(titleWords.length - 1, 5); len >= 2; len--) {
            const candidate = titleWords.slice(0, len).join(' ');
            const result = this._tryGetSuggestion(candidate, aliasMap, false);
            if (result) return applyOverride(result);
        }

        // Strategy 6: First-word fallback (ambiguous words blocked)
        const firstWord = title.split(/[\s\-\u2013\u2014_]/)[0].trim();
        if (firstWord.length > 2) {
            const result = this._tryGetSuggestion(firstWord, aliasMap, false);
            if (result) return applyOverride(result);
        }

        return null;
    },

    getComposerExtractionSignals(targetIds = []) {
        const signals = {
            titleExtractions: [],
            nameCompletions: [],
            checked: 0,
            skipped: 0
        };

        if (!this.composerField || !this.titleField) {
            return signals;
        }

        const aliasMap = this.getComposerAliasMap();

        targetIds.forEach(id => {
            const row = this.dataById.get(id);
            if (!row) return;

            const title = row[this.titleField] || '';
            const currentComposer = row[this.composerField] || '';

            if (currentComposer) {
                signals.skipped++;
            } else {
                signals.checked++;

                const result = this._extractComposerFromTitle(title, aliasMap);
                if (result) {
                    signals.titleExtractions.push({
                        id,
                        title,
                        extracted: result.extracted,
                        suggestion: result.suggestion,
                        type: 'title'
                    });
                }
            }

            if (currentComposer) {
                const contextText = `${title} ${currentComposer}`.trim();
                const suggestion = this._applyBachContextOverride(
                    this.getSuggestion(currentComposer, aliasMap),
                    contextText
                );
                const formattedSuggestion = suggestion ? this.formatComposerName(suggestion) || suggestion : null;
                const currentFormatted = this.formatComposerName(currentComposer.trim()) || currentComposer.trim();
                if (formattedSuggestion && formattedSuggestion !== currentFormatted) {
                    signals.nameCompletions.push({
                        id,
                        title,
                        extracted: currentComposer.trim(),
                        suggestion,
                        type: 'completion'
                    });
                }
            }
        });

        return signals;
    },

    getStandardizeComposerCandidateIds(targetIds = []) {
        if (!this.composerField) {
            return [];
        }

        const mode = this.settings?.composer?.nameDisplayFormat || 'last_first';
        const candidates = [];

        targetIds.forEach(id => {
            const row = this.dataById.get(id);
            if (!row) return;

            const composer = row[this.composerField];
            if (!composer) return;

            const normalized = composer.trim();
            if (!normalized) return;

            const newVal = this.formatComposerName(normalized, mode);
            if (!newVal || newVal === normalized) return;

            candidates.push(id);
        });

        return candidates;
    },

    computeScanResults(targetIds = null) {
        const ids = Array.isArray(targetIds)
            ? targetIds
            : this.data.map(row => row.__id);

        const candidates = {
            missingComposer: [],
            composerFormatting: [],
            imslpTitles: []
        };

        const extractionSignals = this.getComposerExtractionSignals(ids);
        const extractionCandidateIds = new Set([
            ...extractionSignals.titleExtractions.map(item => item.id),
            ...extractionSignals.nameCompletions.map(item => item.id)
        ]);
        candidates.missingComposer = [...extractionCandidateIds];

        candidates.composerFormatting = this.getStandardizeComposerCandidateIds(ids);

        ids.forEach(id => {
            const row = this.dataById.get(id);
            if (!row) return;

            const title = this.titleField ? (row[this.titleField] || '') : '';

            if (this.titleField && this.needsImslpCleanup(title) && this.cleanImslpTitle(title) !== title) {
                candidates.imslpTitles.push(id);
            }

        });

        return {
            counts: {
                missingComposer: candidates.missingComposer.length,
                composerFormatting: candidates.composerFormatting.length,
                imslpTitles: candidates.imslpTitles.length
            },
            candidates,
            extractionSignals: {
                checked: extractionSignals.checked,
                skipped: extractionSignals.skipped,
                titleCount: extractionSignals.titleExtractions.length,
                completionCount: extractionSignals.nameCompletions.length
            }
        };
    },

    detectComposerFromTitle(title = '') {
        return this._extractComposerFromTitle(title) !== null;
    },

    needsComposerStandardization(composer = '') {
        const normalized = composer.trim();
        if (!normalized) return false;

        const suggestion = this.getSuggestion(normalized);
        const formattedSuggestion = suggestion ? (this.formatComposerName(suggestion) || suggestion) : null;
        const currentFormatted = this.formatComposerName(normalized) || normalized;
        if (formattedSuggestion && formattedSuggestion !== currentFormatted) {
            return true;
        }

        const mode = this.settings?.composer?.nameDisplayFormat || 'last_first';
        const standardized = this.formatComposerName(normalized, mode);
        return Boolean(standardized && standardized !== normalized);
    },

    updateScanResults() {
        const counts = this.scanResults?.counts || {
            missingComposer: 0,
            composerFormatting: 0,
            imslpTitles: 0
        };
        const targets = {
            scanCountMissingComposer: counts.missingComposer,
            scanCountVariantComposer: counts.composerFormatting,
            scanCountImslpTitles: counts.imslpTitles
        };

        Object.entries(targets).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    },

    runScanFix(type) {
        if (type === 'missingComposer') {
            this.smartExtract();
            return;
        }
        if (type === 'composerFormatting') {
            this.standardizeComposers();
            return;
        }
        if (type === 'imslpTitles') {
            this.cleanImslpTitles();
            return;
        }
    },

    smartExtract() {
        console.log('Smart Extract started');

        if (!this.composerField || !this.titleField) {
            this.showNotification('Required fields not found');
            return;
        }

        const targetIndices = this.getTargetIds();
        console.log('Processing', targetIndices.length, 'entries');

        const signals = this.getComposerExtractionSignals(targetIndices);
        const titleExtractions = signals.titleExtractions;
        const nameCompletions = signals.nameCompletions;
        const checked = signals.checked;
        const skipped = signals.skipped;
        const extracted = [...titleExtractions, ...nameCompletions];

        console.log('Results:', {
            scanned: targetIndices.length,
            checked: checked,
            skipped: skipped,
            titleExtractions: titleExtractions.length,
            nameCompletions: nameCompletions.length
        });

        if (extracted.length === 0) {
            this.showNotification(`Smart Extract checked ${checked} entries with blank composers and ${skipped} with existing composers, but found no suggestions.

This works best with titles like:
• "Bach - Prelude" or "Prelude - Bach"
• "Beethoven Symphony" or "Symphony (Beethoven)"
• "Suite No. 1 by Bach"

It also detects incomplete names like "bach" or "beethoven" in the composer field.`);
            return;
        }

        this.pendingExtraction = extracted;
        this.extractionCounts = {
            titleCount: titleExtractions.length,
            completionCount: nameCompletions.length
        };
        this.showExtractionModal();
    },

    toggleComposerStats(e) {
        e.stopPropagation();
        const dropdown = document.getElementById('composerStatsDropdown');
        if (!dropdown.classList.contains('hidden')) {
            dropdown.classList.add('hidden');
            return;
        }

        const counts = {};
        this.data.forEach(row => {
            const composer = this.composerField ? (row[this.composerField] || '').trim() : '';
            if (composer) {
                counts[composer] = (counts[composer] || 0) + 1;
            }
        });

        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const top = sorted.slice(0, 20);

        let html = `<div class="stat-dropdown-title">Top Composers</div><div class="stat-dropdown-list">`;
        top.forEach(([name, count]) => {
            html += `<div class="stat-dropdown-row">
                <span class="stat-dropdown-name">${this.escapeHtml(name)}</span>
                <span class="stat-dropdown-count">${count}</span>
            </div>`;
        });
        if (sorted.length > 20) {
            html += `<div class="stat-dropdown-row" style="color:var(--color-text-muted);font-size:13px;">
                <span>+${sorted.length - 20} more</span><span></span>
            </div>`;
        }
        html += '</div>';

        dropdown.innerHTML = html;
        dropdown.classList.remove('hidden');

        const closeDropdown = (ev) => {
            if (!dropdown.contains(ev.target) && ev.target !== dropdown) {
                dropdown.classList.add('hidden');
                document.removeEventListener('click', closeDropdown);
            }
        };
        setTimeout(() => document.addEventListener('click', closeDropdown), 0);
    },

    toggleModifiedStats(e) {
        e.stopPropagation();
        const dropdown = document.getElementById('modifiedStatsDropdown');
        if (!dropdown.classList.contains('hidden')) {
            dropdown.classList.add('hidden');
            return;
        }

        // Per-field breakdown
        const fields = [
            { name: 'Titles', field: this.titleField },
            { name: 'Composers', field: this.composerField },
            { name: 'Genres', field: this.genreField },
            { name: 'Tags', field: this.tagsField }
        ];

        const fieldCounts = {};
        fields.forEach(f => { fieldCounts[f.name] = 0; });

        this.data.forEach(row => {
            const orig = this.originalData[row.__id];
            if (!orig) return;
            fields.forEach(f => {
                if (f.field && (row[f.field] || '') !== (orig[f.field] || '')) {
                    fieldCounts[f.name]++;
                }
            });
        });

        let html = '';

        // Field breakdown section
        const hasFieldChanges = Object.values(fieldCounts).some(c => c > 0);
        if (hasFieldChanges) {
            html += `<div class="stat-dropdown-title">Changed Fields</div><div class="stat-dropdown-list">`;
            Object.entries(fieldCounts).forEach(([name, count]) => {
                if (count > 0) {
                    html += `<div class="stat-dropdown-row">
                        <span class="stat-dropdown-name">${this.escapeHtml(name)}</span>
                        <span class="stat-dropdown-count">${count}</span>
                    </div>`;
                }
            });
            html += '</div>';
        }

        // Operations breakdown section
        if (this.changeLog.length > 0) {
            html += `<div class="stat-dropdown-title" style="margin-top:4px;">Operations</div><div class="stat-dropdown-list">`;
            this.changeLog.forEach(({category, count}) => {
                html += `<div class="stat-dropdown-row">
                    <span class="stat-dropdown-name">${category}</span>
                    <span class="stat-dropdown-count">${count}</span>
                </div>`;
            });
            html += '</div>';
        }

        if (!html) {
            html = `<div class="stat-dropdown-title">No changes yet</div>`;
        }

        dropdown.innerHTML = html;
        dropdown.classList.remove('hidden');

        const closeDropdown = (ev) => {
            if (!dropdown.contains(ev.target) && ev.target !== dropdown) {
                dropdown.classList.add('hidden');
                document.removeEventListener('click', closeDropdown);
            }
        };
        setTimeout(() => document.addEventListener('click', closeDropdown), 0);
    },

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

    cleanImslpTitles() {
        console.log('IMSLP Cleanup started');
        
        if (!this.titleField) {
            this.showNotification('Title field not found');
            return;
        }

        let cleanable = [];
        const targetIndices = this.getTargetIds();

        targetIndices.forEach(idx => {
            const row = this.dataById.get(idx);
            const title = row[this.titleField] || '';

            // Check if this looks like an IMSLP title
            if (this.needsImslpCleanup(title)) {
                const cleaned = this.cleanImslpTitle(title);
                if (cleaned !== title) {
                    cleanable.push({
                        id: idx,
                        original: title,
                        cleaned
                    });
                }
            }
        });

        console.log('IMSLP cleanup results:', {
            scanned: targetIndices.length,
            cleanable: cleanable.length
        });

        if (cleanable.length === 0) {
            this.showNotification('No IMSLP titles found to clean.\n\nLooking for titles with:\n• IMSLP numbers\n• PMLP numbers\n• Excessive underscores');
            return;
        }

        // Store cleanup results and show modal
        this.pendingImslpCleanup = cleanable;
        this.showImslpModal();
    },

    needsImslpCleanup(title) {
        // Check if title has IMSLP patterns that need cleaning
        return /IMSLP\d+/.test(title) || 
               /PMLP\d+/.test(title) || 
               /_[A-Z]/.test(title) ||  // Has underscore before capital letter
               /^_/.test(title) ||      // Starts with underscore
               title.split('_').length > 3;  // Has multiple underscores
    },

    cleanImslpTitle(title, addLabel = true) {
        let cleaned = title;
        
        // Remove IMSLP and PMLP prefixes with numbers
        cleaned = cleaned.replace(/^IMSLP\d+-?/g, '');
        cleaned = cleaned.replace(/^PMLP\d+-?/g, '');
        cleaned = cleaned.replace(/-PMLP\d+-?/g, '-');
        
        // Convert underscores to spaces
        cleaned = cleaned.replace(/_/g, ' ');
        
        // Remove leading/trailing dashes and spaces
        cleaned = cleaned.replace(/^[-\s]+|[-\s]+$/g, '');
        
        // Clean up multiple spaces
        cleaned = cleaned.replace(/\s+/g, ' ');
        
        // Remove .pdf extension if present
        cleaned = cleaned.replace(/\.pdf$/i, '');
        
        // Add (IMSLP) suffix if option enabled and it looked like an IMSLP file
        if (addLabel && title.match(/IMSLP\d+|PMLP\d+/) && !cleaned.includes('(IMSLP)')) {
            cleaned = cleaned + ' (IMSLP)';
        }
        
        return cleaned.trim();
    },

    standardizeComposers() {
        if (!this.composerField) {
            this.showNotification('Composer field not found in your CSV');
            return;
        }

        const targetIndices = this.getTargetIds();
        const changes = [];
        const mode = this.settings?.composer?.nameDisplayFormat || 'last_first';

        targetIndices.forEach(idx => {
            const row = this.dataById.get(idx);
            const composer = row[this.composerField];
            if (!composer) return;

            const normalized = composer.trim();
            if (!normalized) return;

            const newVal = this.formatComposerName(normalized, mode);
            if (!newVal || newVal === normalized) return;

            changes.push({
                id: idx,
                label: `Row ${idx + 1}`,
                detail: composer,
                newDetail: newVal,
                field: this.composerField,
                newVal
            });
        });

        if (changes.length === 0) {
            const scopeLabel = this.getScopeLabel();
            const scope = scopeLabel ? ` (${scopeLabel})` : '';
            this.showNotification(`No composers to standardize${scope}`);
            return;
        }

        const modeLabel = mode === 'first_last' ? '"First Last"' : mode === 'preserve' ? 'the current formatting policy' : '"Last, First"';
        this._showPreview('Standardize Composers Preview', `Found <strong>${changes.length}</strong> composer${changes.length !== 1 ? 's' : ''} to reformat using ${modeLabel}.`, changes, 'Composers standardized', 'Standardize');
    },

    // ===== Shared Preview Modal =====

    // ===== Genre & Tag Tools =====

    toggleGenreTagMenu(e) {
        e.stopPropagation();
        const dropdown = document.getElementById('genreTagDropdown');
        const trigger = document.getElementById('genreTagMenuTrigger');
        const isOpen = dropdown.classList.contains('active');
        const nextOpenState = !isOpen;
        dropdown.classList.toggle('active', nextOpenState);
        trigger.classList.toggle('active', nextOpenState);
        trigger.setAttribute('aria-expanded', nextOpenState ? 'true' : 'false');
        if (!isOpen) {
            const closeHandler = (event) => {
                if (!dropdown.contains(event.target) && !trigger.contains(event.target)) {
                    dropdown.classList.remove('active');
                    trigger.classList.remove('active');
                    trigger.setAttribute('aria-expanded', 'false');
                    document.removeEventListener('click', closeHandler);
                }
            };
            setTimeout(() => document.addEventListener('click', closeHandler), 0);
        }
    },

    closeGenreTagMenu() {
        document.getElementById('genreTagDropdown').classList.remove('active');
        const trigger = document.getElementById('genreTagMenuTrigger');
        trigger.classList.remove('active');
        trigger.setAttribute('aria-expanded', 'false');
    },

    getComposerEra(composerValue) {
        if (!composerValue) return null;
        const trimmed = composerValue.trim();
        if (this.composerEraDatabase[trimmed]) return this.composerEraDatabase[trimmed];
        const canonical = this.getSuggestion(trimmed);
        if (canonical && this.composerEraDatabase[canonical]) return this.composerEraDatabase[canonical];
        return null;
    },

    // --- Suggest Genre from Composer ---

    suggestGenres() {
        this.closeGenreTagMenu();
        if (!this.composerField || !this.genreField) {
            this.showNotification('Composer and Genre fields are required');
            return;
        }

        const targetIndices = this.getTargetIds();
        let suggestions = [];

        targetIndices.forEach(idx => {
            const row = this.dataById.get(idx);
            const genre = (row[this.genreField] || '').trim();
            const composer = (row[this.composerField] || '').trim();
            if (genre || !composer) return;

            const era = this.getComposerEra(composer);
            if (era) {
                suggestions.push({
                    id: idx,
                    composer: composer,
                    suggestedGenre: era,
                    title: row[this.titleField] || ''
                });
            }
        });

        if (suggestions.length === 0) {
            const scopeLabel = this.getScopeLabel();
            const scope = scopeLabel ? ` (${scopeLabel})` : '';
            this.showNotification(`No genre suggestions found${scope}.\n\nThis fills empty genres based on the composer's era.\nComposers must be recognized (try Smart Extract first).`);
            return;
        }

        this.pendingGenreSuggestions = suggestions;
        this.selectedGenreSuggestions = new Set(suggestions.map((_, i) => i));
        this.showGenreSuggestModal();
    },

    showGenreSuggestModal() {
        const modal = document.getElementById('genreSuggestModal');
        const resultsDiv = document.getElementById('genreSuggestResults');
        document.getElementById('genreSuggestCount').textContent = this.pendingGenreSuggestions.length;

        let html = '';
        this.pendingGenreSuggestions.forEach((item, index) => {
            html += `
                <div class="extraction-item">
                    <input type="checkbox" class="extraction-checkbox"
                           id="genre_${index}"
                           onchange="app.toggleGenreSuggestion(${index})" checked>
                    <label for="genre_${index}" class="extraction-label">
                        <div class="extraction-mapping">
                            <span class="extraction-original">${this.escapeHtml(item.composer)}</span>
                            <span class="extraction-arrow">&rarr;</span>
                            <span class="extraction-suggestion">${this.escapeHtml(item.suggestedGenre)}</span>
                        </div>
                        <div class="extraction-title">${this.escapeHtml(item.title)}</div>
                    </label>
                </div>
            `;
        });

        resultsDiv.innerHTML = html;
        this.updateGenreSuggestSelectedCount();
        modal.classList.add('active');
    },

    toggleGenreSuggestion(index) {
        if (this.selectedGenreSuggestions.has(index)) {
            this.selectedGenreSuggestions.delete(index);
        } else {
            this.selectedGenreSuggestions.add(index);
        }
        document.getElementById(`genre_${index}`).checked = this.selectedGenreSuggestions.has(index);
        const selectAll = document.getElementById('selectAllGenreSuggestions');
        selectAll.checked = this.selectedGenreSuggestions.size === this.pendingGenreSuggestions.length;
        selectAll.indeterminate = this.selectedGenreSuggestions.size > 0 && this.selectedGenreSuggestions.size < this.pendingGenreSuggestions.length;
        this.updateGenreSuggestSelectedCount();
    },

    toggleAllGenreSuggestions() {
        const checked = document.getElementById('selectAllGenreSuggestions').checked;
        this.selectedGenreSuggestions = checked ? new Set(this.pendingGenreSuggestions.map((_, i) => i)) : new Set();
        this.pendingGenreSuggestions.forEach((_, i) => {
            const el = document.getElementById(`genre_${i}`);
            if (el) el.checked = checked;
        });
        this.updateGenreSuggestSelectedCount();
    },

    updateGenreSuggestSelectedCount() {
        const count = this.selectedGenreSuggestions.size;
        const total = this.pendingGenreSuggestions.length;
        const span = document.getElementById('genreSuggestSelectedCount');
        if (count === total) span.textContent = 'All selected';
        else if (count === 0) span.textContent = 'None selected';
        else span.textContent = `${count} of ${total} selected`;
    },

    closeGenreSuggestModal() {
        document.getElementById('genreSuggestModal').classList.remove('active');
        this.pendingGenreSuggestions = null;
        this.selectedGenreSuggestions = null;
    },

    applyGenreSuggestions() {
        if (!this.pendingGenreSuggestions || !this.selectedGenreSuggestions) return;
        if (this.selectedGenreSuggestions.size === 0) {
            this.showNotification('Please select at least one suggestion to apply');
            return;
        }

        this.pushUndo('Suggest Genre');
        let count = 0;
        this.selectedGenreSuggestions.forEach(index => {
            const suggestion = this.pendingGenreSuggestions[index];
            this.dataById.get(suggestion.id)[this.genreField] = suggestion.suggestedGenre;
            this.modifiedCount++;
            count++;
        });

        this.logChange('Genres suggested from composer', count);
        this.closeGenreSuggestModal();
        this.analyzeData();
        this.renderAll();
        this.showNotification(`Applied genre to ${count} row${count !== 1 ? 's' : ''}`);
    },

    // --- Suggest Tags from Titles ---

    suggestTags() {
        this.closeGenreTagMenu();
        if (!this.titleField || !this.tagsField) {
            this.showNotification('Title and Tags fields are required');
            return;
        }

        const targetIndices = this.getTargetIds();
        let suggestions = [];

        targetIndices.forEach(idx => {
            const row = this.dataById.get(idx);
            const title = (row[this.titleField] || '').trim();
            if (!title) return;

            const existingTags = (row[this.tagsField] || '')
                .split(';').map(t => t.trim().toLowerCase()).filter(Boolean);

            let newTags = [];
            this.tagKeywordDatabase.forEach(entry => {
                if (entry.pattern.test(title)) {
                    if (!existingTags.includes(entry.tag.toLowerCase()) && !newTags.includes(entry.tag)) {
                        newTags.push(entry.tag);
                    }
                }
            });

            // Key signature detection
            const keyMatch = title.match(/\b(?:in\s+)?([A-G])[\s-]?([#♯]|flat|[b♭])?\s*[-\s]?(major|minor|maj\.?|min\.?|dur|moll)\b/i);
            if (keyMatch) {
                let note = keyMatch[1].toUpperCase();
                const accidental = (keyMatch[2] || '').toLowerCase();
                if (accidental === '#' || accidental === '♯') note += ' sharp';
                else if (accidental === 'b' || accidental === '♭' || accidental === 'flat') note += ' flat';
                const quality = keyMatch[3].toLowerCase();
                const mode = (quality.startsWith('maj') || quality === 'dur') ? 'major' : 'minor';
                const keyTag = `${note} ${mode}`;
                if (!existingTags.includes(keyTag.toLowerCase()) && !newTags.includes(keyTag)) {
                    newTags.push(keyTag);
                }
            }

            if (newTags.length > 0) {
                suggestions.push({
                    id: idx,
                    title: title,
                    existingTags: row[this.tagsField] || '',
                    suggestedTags: newTags
                });
            }
        });

        if (suggestions.length === 0) {
            const scopeLabel = this.getScopeLabel();
            const scope = scopeLabel ? ` (${scopeLabel})` : '';
            this.showNotification(`No tag suggestions found${scope}.\n\nThis scans titles for musical terms:\n- Instruments (piano, violin, cello...)\n- Forms (sonata, concerto, fugue...)\n- Ensembles (orchestra, trio, quartet...)\n- Key signatures (C major, D minor...)`);
            return;
        }

        this.pendingTagSuggestions = suggestions;
        this.selectedTagSuggestions = new Set(suggestions.map((_, i) => i));
        this.showTagSuggestModal();
    },

    showTagSuggestModal() {
        const modal = document.getElementById('tagSuggestModal');
        const resultsDiv = document.getElementById('tagSuggestResults');
        document.getElementById('tagSuggestCount').textContent = this.pendingTagSuggestions.length;

        let html = '';
        this.pendingTagSuggestions.forEach((item, index) => {
            const tagBadges = item.suggestedTags.map(t => `<span class="tag-suggest-new">+ ${this.escapeHtml(t)}</span>`).join(' ');
            html += `
                <div class="extraction-item">
                    <input type="checkbox" class="extraction-checkbox"
                           id="tagsug_${index}"
                           onchange="app.toggleTagSuggestion(${index})" checked>
                    <label for="tagsug_${index}" class="extraction-label">
                        <div class="extraction-title">${this.escapeHtml(item.title)}</div>
                        <div class="extraction-mapping" style="margin-top:4px">${tagBadges}</div>
                    </label>
                </div>
            `;
        });

        resultsDiv.innerHTML = html;
        this.updateTagSuggestSelectedCount();
        modal.classList.add('active');
    },

    toggleTagSuggestion(index) {
        if (this.selectedTagSuggestions.has(index)) {
            this.selectedTagSuggestions.delete(index);
        } else {
            this.selectedTagSuggestions.add(index);
        }
        document.getElementById(`tagsug_${index}`).checked = this.selectedTagSuggestions.has(index);
        const selectAll = document.getElementById('selectAllTagSuggestions');
        selectAll.checked = this.selectedTagSuggestions.size === this.pendingTagSuggestions.length;
        selectAll.indeterminate = this.selectedTagSuggestions.size > 0 && this.selectedTagSuggestions.size < this.pendingTagSuggestions.length;
        this.updateTagSuggestSelectedCount();
    },

    toggleAllTagSuggestions() {
        const checked = document.getElementById('selectAllTagSuggestions').checked;
        this.selectedTagSuggestions = checked ? new Set(this.pendingTagSuggestions.map((_, i) => i)) : new Set();
        this.pendingTagSuggestions.forEach((_, i) => {
            const el = document.getElementById(`tagsug_${i}`);
            if (el) el.checked = checked;
        });
        this.updateTagSuggestSelectedCount();
    },

    updateTagSuggestSelectedCount() {
        const count = this.selectedTagSuggestions.size;
        const total = this.pendingTagSuggestions.length;
        const span = document.getElementById('tagSuggestSelectedCount');
        if (count === total) span.textContent = 'All selected';
        else if (count === 0) span.textContent = 'None selected';
        else span.textContent = `${count} of ${total} selected`;
    },

    closeTagSuggestModal() {
        document.getElementById('tagSuggestModal').classList.remove('active');
        this.pendingTagSuggestions = null;
        this.selectedTagSuggestions = null;
    },

    applyTagSuggestions() {
        if (!this.pendingTagSuggestions || !this.selectedTagSuggestions) return;
        if (this.selectedTagSuggestions.size === 0) {
            this.showNotification('Please select at least one suggestion to apply');
            return;
        }

        this.pushUndo('Suggest Tags');
        let count = 0;
        this.selectedTagSuggestions.forEach(index => {
            const suggestion = this.pendingTagSuggestions[index];
            const row = this.dataById.get(suggestion.id);
            const existing = (row[this.tagsField] || '').trim();
            const newTagStr = suggestion.suggestedTags.join(';');
            row[this.tagsField] = existing ? existing + ';' + newTagStr : newTagStr;
            this.modifiedCount++;
            count++;
        });

        this.logChange('Tags suggested from titles', count);
        this.closeTagSuggestModal();
        this.analyzeData();
        this.renderAll();
        this.showNotification(`Added tags to ${count} row${count !== 1 ? 's' : ''}`);
    },

    // --- Genre/Tag Manager ---

    managerTab: 'genres',
    managerData: [],
    managerSelectedValues: new Set(),
    managerFilterText: '',

    openBatchTagEditor() {
        this.closeGenreTagMenu();
        if (!this.tagsField) {
            this.showNotification('Tags field is required for the Batch Tag Editor.');
            return;
        }

        const targetIndices = this.getTargetIds();
        const scopeLabel = this.getScopeLabel();
        const scope = scopeLabel ? scopeLabel : `all ${this.data.length} rows`;
        document.getElementById('batchTagScope').innerHTML = `Editing tags for <strong>${targetIndices.length}</strong> rows (${scope}).`;

        this.switchBatchTagMode('add');
        document.getElementById('batchTagModal').classList.add('active');
        document.getElementById('batchTagAddInput').value = '';
        setTimeout(() => document.getElementById('batchTagAddInput').focus(), 100);
    },

    closeBatchTagEditor() {
        document.getElementById('batchTagModal').classList.remove('active');
    },

    switchBatchTagMode(mode) {
        document.querySelectorAll('.batch-tag-tab').forEach((tab, i) => {
            tab.classList.toggle('active', ['add', 'remove', 'replace'][i] === mode);
        });
        document.querySelectorAll('.batch-tag-pane').forEach(p => p.classList.remove('active'));
        document.getElementById('batchTag' + mode.charAt(0).toUpperCase() + mode.slice(1)).classList.add('active');

        if (mode === 'remove') {
            this._renderBatchTagRemoveChips();
        }
    },

    _renderBatchTagRemoveChips() {
        const targetIndices = this.getTargetIds();
        const tagCounts = {};
        targetIndices.forEach(idx => {
            const row = this.dataById.get(idx);
            const tags = (row[this.tagsField] || '').split(';').map(t => t.trim()).filter(Boolean);
            tags.forEach(t => {
                tagCounts[t] = (tagCounts[t] || 0) + 1;
            });
        });

        const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
        const container = document.getElementById('batchTagRemoveChips');

        if (sorted.length === 0) {
            container.innerHTML = '<p style="color:var(--color-text-muted);font-size:13px;">No tags found in target rows.</p>';
            return;
        }

        container.textContent = '';
        const fragment = document.createDocumentFragment();
        sorted.forEach(([tag, count]) => {
            const chip = document.createElement('span');
            chip.className = 'tag-chip';
            chip.addEventListener('click', () => this.batchRemoveTag(tag));

            chip.appendChild(document.createTextNode(`${tag} `));

            const countSpan = document.createElement('span');
            countSpan.className = 'tag-chip-count';
            countSpan.textContent = `(${count})`;
            chip.appendChild(countSpan);

            chip.appendChild(document.createTextNode(' '));

            const removeSpan = document.createElement('span');
            removeSpan.className = 'tag-chip-remove';
            removeSpan.textContent = '×';
            chip.appendChild(removeSpan);

            fragment.appendChild(chip);
        });
        container.appendChild(fragment);
    },

    batchAddTag() {
        const input = document.getElementById('batchTagAddInput');
        const newTag = input.value.trim();
        if (!newTag) return;

        const targetIndices = this.getTargetIds();
        this.pushUndo('Batch Add Tag');
        let count = 0;

        targetIndices.forEach(idx => {
            const row = this.dataById.get(idx);
            const existing = (row[this.tagsField] || '').split(';').map(t => t.trim()).filter(Boolean);
            if (!existing.some(t => t.toLowerCase() === newTag.toLowerCase())) {
                existing.push(newTag);
                row[this.tagsField] = existing.join('; ');
                count++;
            }
        });

        if (count > 0) {
            this.modifiedCount += count;
            this.logChange('Batch add tag', count);
            this.renderTable();
            this.showNotification(`Added "${newTag}" to ${count} row${count !== 1 ? 's' : ''}.`);
        } else {
            this.showNotification(`All target rows already have the tag "${newTag}".`);
        }
        input.value = '';
        input.focus();
    },

    batchRemoveTag(tag) {
        const targetIndices = this.getTargetIds();
        this.pushUndo('Batch Remove Tag');
        let count = 0;

        targetIndices.forEach(idx => {
            const row = this.dataById.get(idx);
            const existing = (row[this.tagsField] || '').split(';').map(t => t.trim()).filter(Boolean);
            const filtered = existing.filter(t => t.toLowerCase() !== tag.toLowerCase());
            if (filtered.length !== existing.length) {
                row[this.tagsField] = filtered.join('; ');
                count++;
            }
        });

        if (count > 0) {
            this.modifiedCount += count;
            this.logChange('Batch remove tag', count);
            this.renderTable();
            this._renderBatchTagRemoveChips();
            this.showNotification(`Removed "${tag}" from ${count} row${count !== 1 ? 's' : ''}.`);
        } else {
            this.showNotification(`Tag "${tag}" not found in target rows.`);
        }
    },

    batchReplaceTag() {
        const fromTag = document.getElementById('batchTagReplaceFrom').value.trim();
        const toTag = document.getElementById('batchTagReplaceTo').value.trim();
        if (!fromTag) {
            this.showNotification('Please enter a tag to find.');
            return;
        }
        if (!toTag) {
            this.showNotification('Please enter a replacement tag.');
            return;
        }

        const targetIndices = this.getTargetIds();
        this.pushUndo('Batch Replace Tag');
        let count = 0;

        targetIndices.forEach(idx => {
            const row = this.dataById.get(idx);
            const existing = (row[this.tagsField] || '').split(';').map(t => t.trim()).filter(Boolean);
            let changed = false;
            const updated = existing.map(t => {
                if (t.toLowerCase() === fromTag.toLowerCase()) {
                    changed = true;
                    return toTag;
                }
                return t;
            });
            const unique = [...new Set(updated.map(t => t.toLowerCase()))].map(lower => {
                return updated.find(t => t.toLowerCase() === lower);
            });
            if (changed) {
                row[this.tagsField] = unique.join('; ');
                count++;
            }
        });

        if (count > 0) {
            this.modifiedCount += count;
            this.logChange('Batch replace tag', count);
            this.renderTable();
            this.showNotification(`Replaced "${fromTag}" with "${toTag}" in ${count} row${count !== 1 ? 's' : ''}.`);
            document.getElementById('batchTagReplaceFrom').value = '';
            document.getElementById('batchTagReplaceTo').value = '';
        } else {
            this.showNotification(`Tag "${fromTag}" not found in target rows.`);
        }
    },

    openManagerModal() {
        this.closeGenreTagMenu();
        this.managerTab = 'genres';
        this.managerSelectedValues = new Set();
        this.managerFilterText = '';
        document.getElementById('managerSearchInput').value = '';
        document.getElementById('managerRenameInput').value = '';
        document.getElementById('managerTabGenres').classList.add('active');
        document.getElementById('managerTabTags').classList.remove('active');
        this.computeManagerData();
        this.renderManagerList();
        document.getElementById('managerModal').classList.add('active');
    },

    switchManagerTab(tab) {
        this.managerTab = tab;
        this.managerSelectedValues = new Set();
        this.managerFilterText = '';
        document.getElementById('managerSearchInput').value = '';
        document.getElementById('managerRenameInput').value = '';
        document.getElementById('managerTabGenres').classList.toggle('active', tab === 'genres');
        document.getElementById('managerTabTags').classList.toggle('active', tab === 'tags');
        this.computeManagerData();
        this.renderManagerList();
    },

    computeManagerData() {
        const counts = {};
        let emptyCount = 0;
        const targetIndices = this.getTargetIds();

        if (this.managerTab === 'genres') {
            if (!this.genreField) { this.managerData = []; return; }
            targetIndices.forEach(idx => {
                const val = (this.dataById.get(idx)[this.genreField] || '').trim();
                if (!val) { emptyCount++; } else { counts[val] = (counts[val] || 0) + 1; }
            });
        } else {
            if (!this.tagsField) { this.managerData = []; return; }
            targetIndices.forEach(idx => {
                const raw = (this.dataById.get(idx)[this.tagsField] || '').trim();
                if (!raw) { emptyCount++; return; }
                const tags = raw.split(';').map(t => t.trim()).filter(Boolean);
                if (tags.length === 0) { emptyCount++; return; }
                tags.forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; });
            });
        }

        let sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([value, count]) => ({ value, count }));

        if (emptyCount > 0) {
            sorted.unshift({ value: '', count: emptyCount, isEmpty: true });
        }

        this.managerData = sorted;
    },

    renderManagerList() {
        const container = document.getElementById('managerList');
        const filter = this.managerFilterText.toLowerCase();

        let html = '';
        this.managerData.forEach((item, index) => {
            if (filter && !item.isEmpty && !item.value.toLowerCase().includes(filter)) return;

            const isChecked = this.managerSelectedValues.has(item.isEmpty ? '' : item.value);
            const nameClass = item.isEmpty ? 'manager-item-name manager-item-name--empty' : 'manager-item-name';
            const displayName = item.isEmpty ? '(empty)' : item.value;

            html += `
                <div class="manager-item">
                    <input type="checkbox" data-index="${index}"
                           onchange="app.toggleManagerItem(${index})"
                           ${isChecked ? 'checked' : ''}>
                    <span class="${nameClass}">${this.escapeHtml(displayName)}</span>
                    <span class="manager-item-count">${item.count}</span>
                </div>
            `;
        });

        container.innerHTML = html || '<div style="padding:20px;text-align:center;color:var(--color-text-muted);">No values found</div>';
        this.updateManagerSelectedCount();
    },

    filterManagerList() {
        this.managerFilterText = document.getElementById('managerSearchInput').value;
        this.renderManagerList();
    },

    toggleManagerItem(index) {
        const item = this.managerData[index];
        if (!item) return;
        const key = item.isEmpty ? '' : item.value;
        if (this.managerSelectedValues.has(key)) {
            this.managerSelectedValues.delete(key);
        } else {
            this.managerSelectedValues.add(key);
        }
        this.updateManagerSelectedCount();
    },

    updateManagerSelectedCount() {
        document.getElementById('managerSelectedCount').textContent = this.managerSelectedValues.size;
    },

    closeManagerModal() {
        document.getElementById('managerModal').classList.remove('active');
        this.managerData = [];
        this.managerSelectedValues = new Set();
    },

    applyManagerRename() {
        const newName = document.getElementById('managerRenameInput').value.trim();

        if (this.managerSelectedValues.size === 0) {
            this.showNotification('Please select at least one value to rename');
            return;
        }

        if (!newName) {
            this.showNotification('Please enter a name to rename to');
            return;
        }

        const selectedValues = new Set(this.managerSelectedValues);
        const targetIndices = this.getTargetIds();

        this.pushUndo('Manager Rename');
        let count = 0;

        if (this.managerTab === 'genres') {
            const field = this.genreField;
            targetIndices.forEach(idx => {
                const row = this.dataById.get(idx);
                const current = (row[field] || '').trim();
                if (selectedValues.has(current) || (selectedValues.has('') && !current)) {
                    if (current !== newName) {
                        row[field] = newName;
                        count++;
                    }
                }
            });
        } else {
            const field = this.tagsField;
            targetIndices.forEach(idx => {
                const row = this.dataById.get(idx);
                const raw = (row[field] || '').trim();
                if (!raw && selectedValues.has('')) {
                    row[field] = newName;
                    count++;
                    return;
                }
                const tags = raw.split(';').map(t => t.trim());
                let changed = false;
                const newTags = tags.map(tag => {
                    if (selectedValues.has(tag)) { changed = true; return newName; }
                    return tag;
                });
                if (changed) {
                    const seen = new Set();
                    const deduped = newTags.filter(t => {
                        if (!t) return false;
                        const lower = t.toLowerCase();
                        if (seen.has(lower)) return false;
                        seen.add(lower);
                        return true;
                    });
                    row[field] = deduped.join(';');
                    count++;
                }
            });
        }

        if (count === 0) {
            this.showNotification('No changes were needed');
            return;
        }

        this.modifiedCount += count;
        const label = this.managerTab === 'genres' ? 'Genre' : 'Tag';
        this.logChange(`${label} rename`, count);
        this.analyzeData();
        this.renderAll();

        this.managerSelectedValues = new Set();
        document.getElementById('managerRenameInput').value = '';
        this.computeManagerData();
        this.renderManagerList();

        this.showNotification(`Renamed in ${count} row${count !== 1 ? 's' : ''}`);
    },

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
