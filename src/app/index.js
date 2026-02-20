import { SETTINGS_VERSION, DEFAULT_SETTINGS } from '../data/settings-defaults.js';
import { builtInComposerDatabase } from '../data/composer-database.js';

const app = {
    data: [],
    originalData: [],
    dataById: new Map(),
    modifiedCount: 0,
    sortColumn: null,
    sortDirection: 'asc',
    selectedIds: new Set(),
    lastToggled: null,
    editGeneration: 0,
    currentFilter: '',
    visibleIds: [],
    undoStack: [],
    changeLog: [],
    settingsStorageKey: 'tidyscore-settings',
    settings: null,
    _notificationQueue: [],
    _notificationActive: false,
    scanResults: null,
    counterConfig: {
        apiBaseUrl: '',
        totalEndpoint: '/counter/total',
        incrementEndpoint: '/counter/increment',
        storageKeys: {
            clientId: 'tidyscore-counter-client-id',
            pendingQueue: 'tidyscore-counter-pending-queue',
            localTotal: 'tidyscore-counter-local-total'
        },
        maxPendingQueue: 50
    },
    anonymousClientId: null,
    sessionId: null,
    globalCleanedCount: null,
    counterPendingQueue: [],
    counterSyncOnline: true,
    _counterFlushTimer: null,
    _counterFlushInFlight: false,

    // Composer database with common variations mapping to full names
    builtInComposerDatabase,

    // Maps canonical composer names to musical era/genre
    composerEraDatabase: {
        // Baroque
        'Bach, Johann Sebastian': 'Baroque',
        'Handel, George Frideric': 'Baroque',
        'Vivaldi, Antonio': 'Baroque',
        'Telemann, Georg Philipp': 'Baroque',
        'Purcell, Henry': 'Baroque',
        'Monteverdi, Claudio': 'Baroque',
        'Scarlatti, Domenico': 'Baroque',
        'Corelli, Arcangelo': 'Baroque',
        'Albinoni, Tomaso': 'Baroque',
        'Pachelbel, Johann': 'Baroque',
        'Rameau, Jean-Philippe': 'Baroque',
        'Lully, Jean-Baptiste': 'Baroque',
        'Buxtehude, Dietrich': 'Baroque',
        'Couperin, François': 'Baroque',
        // Classical
        'Mozart, Wolfgang Amadeus': 'Classical',
        'Haydn, Joseph': 'Classical',
        'Beethoven, Ludwig van': 'Classical',
        'Clementi, Muzio': 'Classical',
        'Hummel, Johann Nepomuk': 'Classical',
        'Boccherini, Luigi': 'Classical',
        'Czerny, Carl': 'Classical',
        // Romantic
        'Chopin, Frédéric': 'Romantic',
        'Schumann, Robert': 'Romantic',
        'Schumann, Clara': 'Romantic',
        'Schubert, Franz': 'Romantic',
        'Liszt, Franz': 'Romantic',
        'Brahms, Johannes': 'Romantic',
        'Mendelssohn, Felix': 'Romantic',
        'Tchaikovsky, Pyotr Ilyich': 'Romantic',
        'Dvořák, Antonín': 'Romantic',
        'Rachmaninoff, Sergei': 'Romantic',
        'Wagner, Richard': 'Romantic',
        'Verdi, Giuseppe': 'Romantic',
        'Puccini, Giacomo': 'Romantic',
        'Grieg, Edvard': 'Romantic',
        'Fauré, Gabriel': 'Romantic',
        'Saint-Saëns, Camille': 'Romantic',
        'Franck, César': 'Romantic',
        'Bruch, Max': 'Romantic',
        'Paganini, Niccolò': 'Romantic',
        'Sibelius, Jean': 'Romantic',
        'Elgar, Edward': 'Romantic',
        'Mahler, Gustav': 'Romantic',
        'Strauss, Richard': 'Romantic',
        'Weber, Carl Maria von': 'Romantic',
        'Mussorgsky, Modest': 'Romantic',
        'Rimsky-Korsakov, Nikolai': 'Romantic',
        'Borodin, Alexander': 'Romantic',
        'Smetana, Bedřich': 'Romantic',
        'Glazunov, Alexander': 'Romantic',
        'Scriabin, Alexander': 'Romantic',
        'Delius, Frederick': 'Romantic',
        'Respighi, Ottorino': 'Romantic',
        'Hanon, Charles-Louis': 'Romantic',
        // Impressionist
        'Debussy, Claude': 'Impressionist',
        'Ravel, Maurice': 'Impressionist',
        'Satie, Erik': 'Impressionist',
        // 20th Century
        'Bartók, Béla': '20th Century',
        'Stravinsky, Igor': '20th Century',
        'Prokofiev, Sergei': '20th Century',
        'Shostakovich, Dmitri': '20th Century',
        'Gershwin, George': '20th Century',
        'Copland, Aaron': '20th Century',
        'Barber, Samuel': '20th Century',
        'Bernstein, Leonard': '20th Century',
        'Britten, Benjamin': '20th Century',
        'Holst, Gustav': '20th Century',
        'Vaughan Williams, Ralph': '20th Century',
        'Kodály, Zoltán': '20th Century',
        'Janáček, Leoš': '20th Century',
        // Contemporary
        'Glass, Philip': 'Contemporary',
        'Pärt, Arvo': 'Contemporary',
        'Adams, John': 'Contemporary',
        'Reich, Steve': 'Contemporary',
        'Cage, John': 'Contemporary',
        'Ligeti, György': 'Contemporary',
        'Messiaen, Olivier': 'Contemporary',
        'Penderecki, Krzysztof': 'Contemporary',
        'Górecki, Henryk': 'Contemporary',
        'Piazzolla, Astor': 'Contemporary',
        'Villa-Lobos, Heitor': 'Contemporary',
        'Ginastera, Alberto': 'Contemporary',
        // Jazz
        'Ellington, Duke': 'Jazz',
        'Coltrane, John': 'Jazz',
        'Monk, Thelonious': 'Jazz',
        'Davis, Miles': 'Jazz',
        'Evans, Bill': 'Jazz',
        'Peterson, Oscar': 'Jazz',
        'Parker, Charlie': 'Jazz',
        'Gillespie, Dizzy': 'Jazz',
        'Brubeck, Dave': 'Jazz',
        'Hancock, Herbie': 'Jazz',
        'Corea, Chick': 'Jazz',
        'Jarrett, Keith': 'Jazz',
        'Metheny, Pat': 'Jazz',
        // Film / Musical Theatre
        'Williams, John': 'Film',
        'Morricone, Ennio': 'Film',
        'Zimmer, Hans': 'Film',
        'Shore, Howard': 'Film',
        'Hisaishi, Joe': 'Film',
        'Uematsu, Nobuo': 'Film',
        'Kondo, Koji': 'Film',
        'Shimomura, Yoko': 'Film',
        'Lloyd Webber, Andrew': 'Musical Theatre',
        'Rodgers, Richard': 'Musical Theatre',
        'Sondheim, Stephen': 'Musical Theatre',
        // Ragtime
        'Joplin, Scott': 'Ragtime',
        // Neo-Classical / Crossover
        'Einaudi, Ludovico': 'Neo-Classical',
        'Yiruma': 'Neo-Classical',
        'Sakamoto, Ryuichi': 'Neo-Classical',
    },

    // Musical keywords in titles mapped to tag suggestions
    tagKeywordDatabase: [
        // Instruments
        { pattern: /\bpiano\b/i, tag: 'piano' },
        { pattern: /\bviolin\b/i, tag: 'violin' },
        { pattern: /\bviola\b(?!\s+da)/i, tag: 'viola' },
        { pattern: /\bcello\b/i, tag: 'cello' },
        { pattern: /\bflute\b/i, tag: 'flute' },
        { pattern: /\boboe\b/i, tag: 'oboe' },
        { pattern: /\bclarinet\b/i, tag: 'clarinet' },
        { pattern: /\bbassoon\b/i, tag: 'bassoon' },
        { pattern: /\btrumpet\b/i, tag: 'trumpet' },
        { pattern: /\bhorn\b/i, tag: 'horn' },
        { pattern: /\btrombone\b/i, tag: 'trombone' },
        { pattern: /\bguitar\b/i, tag: 'guitar' },
        { pattern: /\bharp\b/i, tag: 'harp' },
        { pattern: /\borgan\b/i, tag: 'organ' },
        // Ensemble types
        { pattern: /\borchestra\b/i, tag: 'orchestra' },
        { pattern: /\bchamber\b/i, tag: 'chamber' },
        { pattern: /\bstring quartet\b/i, tag: 'string quartet' },
        { pattern: /\btrio\b/i, tag: 'trio' },
        { pattern: /\bduo\b/i, tag: 'duo' },
        { pattern: /\bsolo\b/i, tag: 'solo' },
        // Forms
        { pattern: /\bsonata\b/i, tag: 'sonata' },
        { pattern: /\bsonatina\b/i, tag: 'sonatina' },
        { pattern: /\bconcerto\b/i, tag: 'concerto' },
        { pattern: /\bsymphon(?:y|ie)\b/i, tag: 'symphony' },
        { pattern: /\bsuite\b/i, tag: 'suite' },
        { pattern: /\bprelude\b/i, tag: 'prelude' },
        { pattern: /\bfugue\b/i, tag: 'fugue' },
        { pattern: /\b[eé]tude\b/i, tag: 'etude' },
        { pattern: /\bnocturne\b/i, tag: 'nocturne' },
        { pattern: /\bwaltz\b/i, tag: 'waltz' },
        { pattern: /\bmazurka\b/i, tag: 'mazurka' },
        { pattern: /\bpolonaise\b/i, tag: 'polonaise' },
        { pattern: /\bballade\b/i, tag: 'ballade' },
        { pattern: /\bscherzo\b/i, tag: 'scherzo' },
        { pattern: /\brondo\b/i, tag: 'rondo' },
        { pattern: /\baria\b/i, tag: 'aria' },
        { pattern: /\bmass\b/i, tag: 'mass' },
        { pattern: /\brequiem\b/i, tag: 'requiem' },
        { pattern: /\bcantata\b/i, tag: 'cantata' },
        { pattern: /\bopera\b/i, tag: 'opera' },
        { pattern: /\boverture\b/i, tag: 'overture' },
        { pattern: /\brhapsod(?:y|ie)\b/i, tag: 'rhapsody' },
        { pattern: /\bfantas(?:y|ia|ie)\b/i, tag: 'fantasy' },
        { pattern: /\bvariations?\b/i, tag: 'variations' },
        { pattern: /\bminuet\b/i, tag: 'minuet' },
        { pattern: /\bgavotte\b/i, tag: 'gavotte' },
        { pattern: /\bsarabande\b/i, tag: 'sarabande' },
        { pattern: /\ballemande\b/i, tag: 'allemande' },
        { pattern: /\bbourr[eé]e\b/i, tag: 'bourree' },
        { pattern: /\bgigue\b/i, tag: 'gigue' },
        { pattern: /\btoccata\b/i, tag: 'toccata' },
        { pattern: /\binvention\b/i, tag: 'invention' },
        { pattern: /\bpartita\b/i, tag: 'partita' },
        { pattern: /\bserenade\b/i, tag: 'serenade' },
        { pattern: /\bdivertimento\b/i, tag: 'divertimento' },
        // Vocal
        { pattern: /\bchoir\b|\bchoral\b|\bchorus\b/i, tag: 'choral' },
        { pattern: /\blied(?:er)?\b/i, tag: 'lied' },
    ],

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

    handleFile(file) {
        if (!file || !file.name.endsWith('.csv')) {
            this.showNotification('Please upload a CSV file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.parseCSV(e.target.result);
        };
        reader.readAsText(file);
    },

    loadSample() {
        const sampleCSV = [
            'Title,Composers,Genre,Tags,Filename',
            'Bach - Cello Suite No. 1 in G Major,,Baroque,cello,Bach - Cello Suite No.1 in G Major.pdf',
            'Prelude in C Major,bach,Baroque,piano;keyboard,Bach - Prelude in C Major BWV 846.pdf',
            'Moonlight Sonata,beethoven,Classical,piano,Moonlight Sonata.pdf',
            '"Symphony No. 5, Op. 67",Ludwig van Beethoven,Classical,orchestra,Beethoven Symphony No.5 Op.67.pdf',
            'Clair de Lune,Debussy,Romantic,piano,Clair de Lune.pdf',
            'The Four Seasons - Spring,vivaldi ,Baroque,violin;ensemble,The Four Seasons - Spring.pdf',
            '"Nocturne Op. 9, No. 2",chopin,Romantic,piano,"Nocturne Op. 9, No. 2.pdf"',
            'Hungarian Rhapsody No. 2, ,Romantic,piano,Hungarian Rhapsody No. 2.pdf',
            'Ave Maria," Schubert, Franz ",Classical,vocal,Ave Maria.pdf',
            'Gymnopédie No. 1,Erik Satie,Modern,piano,Gymnopédie No. 1.pdf',
            'Canon in D,Pachelbel,Baroque,ensemble,Canon in D.pdf',
            'Für Elise,beethoven,Classical,piano,Für Elise.pdf',
            '"IMSLP00001-Beethoven - Piano Sonata No.8, Op.13",,Classical,piano,"IMSLP00001-Beethoven - Piano Sonata No.8, Op.13.pdf"',
            'Rêverie,debussy,Romantic,piano,Rêverie.pdf',
            'Boléro,ravel,Modern,orchestra,Boléro.pdf',
            'Träumerei,Robert Schumann,Romantic,piano,Träumerei.pdf',
            'Liebestraum No. 3,liszt,Romantic,piano,Liebestraum No. 3.pdf',
            'The Nutcracker Suite,tchaikovsky,Romantic,orchestra,The Nutcracker Suite.pdf',
            'New World Symphony,dvorak,Romantic,orchestra;symphony,New World Symphony.pdf',
            'Piano Concerto No. 2,rachmaninoff,Romantic,piano;orchestra,Piano Concerto No. 2.pdf',
            'C.P.E. Bach - Solfeggietto in C Minor,,Baroque,keyboard;study,C.P.E. Bach - Solfeggietto in C Minor.pdf',
            'Solfeggietto in C Minor,cpe bach,Baroque,keyboard,Solfeggietto in C Minor.pdf',
            '"Clara Schumann - Romance in A Minor, Op. 21 No. 1",,Romantic,piano,"Romance in A Minor, Op.21 No.1.pdf"',
            '"Romance in A Minor, Op. 21 No. 1",clara schumann,Romantic,piano,"Romance in A Minor, Op.21 No.1 (scan).pdf"',
            'J.S. Bach: Invention No. 1 in C Major,,Baroque,piano;pedagogy,J.S. Bach: Invention No. 1 in C Major.pdf',
            'WTC Book I - Prelude and Fugue in C major (Bach),,Baroque,piano,WTC Book I - Prelude and Fugue in C major (Bach).pdf',
            'Haydn - Cello Concerto No. 1 in C Major,,Classical,cello;orchestra,Haydn - Cello Concerto No. 1 in C Major.pdf',
            '"Mozart: Sonata in C Major, K.545",,Classical,piano,Sonata in C Major K545.pdf',
            'Sonata in C Major K.545,m0zart,Classical,piano,Sonata in C Major K545.pdf',
            'Rachmaninoff - Vocalise Op.34 No.14,,Romantic,voice;violin,Rachmaninoff - Vocalise Op.34 No.14.pdf',
            'Mahler: Symphony No. 5 - Adagietto,,Romantic,orchestra,Mahler: Symphony No. 5 - Adagietto.pdf',
            'Gershwin - Rhapsody in Blue,,Jazz,piano;orchestra,Gershwin - Rhapsody in Blue.pdf',
            'Scott Joplin - The Entertainer,,Ragtime,piano,Scott Joplin - The Entertainer.pdf',
            'Piazzolla: Libertango,,Contemporary,tango;ensemble,Piazzolla: Libertango.pdf',
            'Arvo Pärt - Spiegel im Spiegel,,Neo-Classical,violin;piano,Arvo Pärt - Spiegel im Spiegel.pdf',
            'Hans Zimmer - Time,,Film,piano,Hans Zimmer - Time.pdf',
            'Yiruma - River Flows in You,,Contemporary,piano,Yiruma - River Flows in You.pdf',
            'Satie: Gnossienne No. 1,,Modern,piano,Satie: Gnossienne No. 1.pdf',
            'Debussy Arabesque No.1,debussy,Impressionist,piano,Debussy Arabesque No.1.pdf',
            'Prokofiev: Dance of the Knights,,20th Century,orchestra,Prokofiev: Dance of the Knights.pdf'
        ].join('\n');
        this.parseCSV(sampleCSV);
    },

    parseCSV(text) {
        const lines = text.split('\n').filter(line => line.trim());
        
        // Parse header line more carefully
        const headerValues = this.parseCSVLine(lines[0]);
        const headers = headerValues.map(h => h.trim().replace(/^"|"$/g, ''));
        
        console.log('Detected headers:', headers);
        
        this.data = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = this.parseCSVLine(lines[i]);
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            this.data.push(row);
        }

        console.log('Parsed data:', this.data.slice(0, 3));
        console.log('Total rows:', this.data.length);

        if (this.data.length === 0) {
            this.showNotification('No data found in CSV. Please check the file format.');
            return;
        }

        this.data.forEach((row, i) => { row.__id = i; });
        this.dataById = new Map(this.data.map(row => [row.__id, row]));
        this.originalData = JSON.parse(JSON.stringify(this.data));
        this.headers = headers;
        this.selectedIds.clear();
        this.undoStack = [];
        this.analyzeData();
        this.renderAll();
    },

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        
        return values.map(v => v.replace(/^"|"$/g, ''));
    },

    analyzeData() {
        this.composerField = this.detectField(['composers', 'composer', 'Composers', 'Composer']);
        this.titleField = this.detectField(['title', 'Title']);
        this.genreField = this.detectField(['genre', 'Genre', 'genres', 'Genres']);
        this.tagsField = this.detectField(['tags', 'Tags', 'tag', 'Tag']);
        this.filenameField = this.detectField(['filename', 'Filename', 'file', 'File']);
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

    detectField(possibleNames) {
        for (let name of possibleNames) {
            if (this.headers.includes(name)) {
                return name;
            }
        }
        return null;
    },

    renderAll() {
        document.getElementById('uploadSection').classList.add('hidden');
        document.getElementById('samplePrompt').classList.add('hidden');
        document.getElementById('helpLink').classList.add('hidden');
        document.getElementById('privacyNote').classList.add('hidden');
        document.getElementById('statsSection').classList.remove('hidden');
        document.getElementById('tableSection').classList.remove('hidden');

        this.updateStats();
        this.renderTable();
    },

    updateStats() {
        const composers = new Set(
            this.data
                .map(r => this.composerField ? r[this.composerField] : '')
                .filter(Boolean)
        );
        
        document.getElementById('totalScores').textContent = this.data.length;
        document.getElementById('uniqueComposers').textContent = composers.size;
        document.getElementById('modifiedCount').textContent = this.modifiedCount;
        this.scanResults = this.computeScanResults();
        this.updateScanResults();
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

    renderTable() {
        const tbody = document.getElementById('tableBody');
        const thead = document.querySelector('thead');

        // Build entries using stable __id
        let entries;
        const query = this.currentFilter;
        if (query) {
            entries = [];
            const q = query.toLowerCase();
            this.data.forEach(row => {
                const searchStr = `${this.titleField ? row[this.titleField] : ''} ${this.composerField ? row[this.composerField] : ''} ${this.genreField ? row[this.genreField] : ''} ${this.tagsField ? row[this.tagsField] : ''}`.toLowerCase();
                if (searchStr.includes(q)) {
                    entries.push({row, _id: row.__id});
                }
            });
        } else {
            entries = this.data.map(row => ({row, _id: row.__id}));
        }

        // Sort entries for display (this.data stays in import order)
        if (this.sortColumn) {
            const field = this.sortColumn, dir = this.sortDirection;
            entries.sort((a, b) => {
                const aVal = (a.row[field] || '').toLowerCase();
                const bVal = (b.row[field] || '').toLowerCase();
                if (!aVal && !bVal) return 0;
                if (!aVal) return 1;
                if (!bVal) return -1;
                return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            });
        }

        this.visibleIds = entries.map(e => e._id);

        // Update row count indicator
        const countEl = document.getElementById('rowCountIndicator');
        if (countEl) {
            if (query) {
                countEl.textContent = `Showing ${entries.length} of ${this.data.length}`;
            } else {
                countEl.textContent = this.data.length === 1 ? '1 row' : `${this.data.length} rows`;
            }
        }

        // Update header with sort indicators and checkbox
        const titleClass = this.sortColumn === this.titleField ? `sorted-${this.sortDirection}` : '';
        const composerClass = this.sortColumn === this.composerField ? `sorted-${this.sortDirection}` : '';
        const genreClass = this.sortColumn === this.genreField ? `sorted-${this.sortDirection}` : '';
        const tagsClass = this.sortColumn === this.tagsField ? `sorted-${this.sortDirection}` : '';

        const allVisibleSelected = this.visibleIds.length > 0 && this.visibleIds.every(id => this.selectedIds.has(id));

        thead.textContent = '';
        const headerRow = document.createElement('tr');

        const checkboxTh = document.createElement('th');
        checkboxTh.className = 'checkbox-cell';
        const selectAll = document.createElement('input');
        selectAll.type = 'checkbox';
        selectAll.id = 'selectAll';
        selectAll.checked = allVisibleSelected;
        selectAll.addEventListener('change', () => this.toggleSelectAll());
        checkboxTh.appendChild(selectAll);
        headerRow.appendChild(checkboxTh);

        const rowNumTh = document.createElement('th');
        rowNumTh.className = 'row-num-cell';
        rowNumTh.textContent = '#';
        headerRow.appendChild(rowNumTh);

        const makeSortableHeader = (label, field, className) => {
            const th = document.createElement('th');
            if (className) th.className = className;
            th.textContent = label;
            th.addEventListener('click', () => this.sortBy(field));
            return th;
        };

        headerRow.appendChild(makeSortableHeader('Title', this.titleField, titleClass));
        headerRow.appendChild(makeSortableHeader('Composer', this.composerField, composerClass));
        headerRow.appendChild(makeSortableHeader('Genre', this.genreField, genreClass));
        headerRow.appendChild(makeSortableHeader('Tags', this.tagsField, tagsClass));
        thead.appendChild(headerRow);

        tbody.textContent = '';
        const fragment = document.createDocumentFragment();
        entries.forEach(({row, _id}) => {
            const title = this.titleField ? row[this.titleField] : '';
            const composer = this.composerField ? row[this.composerField] : '';
            const genre = this.genreField ? row[this.genreField] : '';
            const tags = this.tagsField ? row[this.tagsField] : '';
            const isSelected = this.selectedIds.has(_id);

            const orig = this.originalData[_id];
            const titleMod = orig && title !== (orig[this.titleField] || '') ? ' cell-modified' : '';
            const composerMod = orig && composer !== (orig[this.composerField] || '') ? ' cell-modified' : '';
            const genreMod = orig && genre !== (orig[this.genreField] || '') ? ' cell-modified' : '';
            const tagsMod = orig && tags !== (orig[this.tagsField] || '') ? ' cell-modified' : '';

            const tr = document.createElement('tr');
            if (isSelected) tr.classList.add('selected');

            const rowCheckboxCell = document.createElement('td');
            rowCheckboxCell.className = 'checkbox-cell';
            const rowCheckbox = document.createElement('input');
            rowCheckbox.type = 'checkbox';
            rowCheckbox.checked = isSelected;
            rowCheckbox.addEventListener('change', (event) => this.toggleRow(_id, event));
            rowCheckboxCell.appendChild(rowCheckbox);
            tr.appendChild(rowCheckboxCell);

            const rowNumCell = document.createElement('td');
            rowNumCell.className = 'row-num-cell';
            rowNumCell.textContent = (_id + 1).toString();
            tr.appendChild(rowNumCell);

            const makeEditableCell = (label, field, value, modClass) => {
                const td = document.createElement('td');
                td.setAttribute('data-label', label);
                td.setAttribute('data-editable', 'true');
                if (modClass) td.className = modClass.trim();
                td.addEventListener('click', () => this.editCell(_id, field, td));

                const span = document.createElement('span');
                span.className = 'editable';
                span.textContent = value;
                td.appendChild(span);
                return td;
            };

            tr.appendChild(makeEditableCell('Title', this.titleField, title, titleMod));
            tr.appendChild(makeEditableCell('Composer', this.composerField, composer, composerMod));
            tr.appendChild(makeEditableCell('Genre', this.genreField, genre, genreMod));
            tr.appendChild(makeEditableCell('Tags', this.tagsField, tags, tagsMod));

            fragment.appendChild(tr);
        });

        tbody.appendChild(fragment);
        this.updateBulkControls();
        this.updateScopeIndicator();

        // Sync mobile sort dropdown with current sort state
        const mobileSort = document.getElementById('mobileSortSelect');
        if (mobileSort) {
            if (!this.sortColumn) {
                mobileSort.value = '';
            } else {
                const rmap = {};
                rmap[this.titleField] = 'title';
                rmap[this.composerField] = 'composer';
                rmap[this.genreField] = 'genre';
                rmap[this.tagsField] = 'tags';
                const key = rmap[this.sortColumn];
                mobileSort.value = key ? `${key}-${this.sortDirection}` : '';
            }
        }
    },

    editCell(id, field, cellElement) {
        this.editGeneration++;
        const myGeneration = this.editGeneration;

        // Clean up any previously-editing cell
        const prev = document.querySelector('#tableBody .editing');
        if (prev) {
            const span = document.createElement('span');
            span.className = 'editable';
            span.textContent = prev.value;
            prev.parentNode.replaceChild(span, prev);
        }

        const cell = cellElement;
        const row = this.dataById.get(id);
        const currentValue = row[field] || '';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'editing';
        input.value = currentValue;
        
        let isEscaping = false;
        let suggestionsDropdown = null;
        
        // Function to show suggestions
        const showSuggestions = () => {
            // Only show suggestions for composer field
            if (field !== this.composerField) return;
            
            const suggestion = this.getSuggestion(input.value);
            const formattedSuggestion = suggestion ? this.formatComposerName(suggestion) || suggestion : null;
            if (!formattedSuggestion || formattedSuggestion === input.value) {
                if (suggestionsDropdown) {
                    suggestionsDropdown.remove();
                    suggestionsDropdown = null;
                }
                return;
            }
            
            if (!suggestionsDropdown) {
                suggestionsDropdown = document.createElement('div');
                suggestionsDropdown.className = 'suggestions-dropdown';
                
                const rect = cell.getBoundingClientRect();
                suggestionsDropdown.style.position = 'fixed';
                suggestionsDropdown.style.left = rect.left + 'px';
                suggestionsDropdown.style.top = (rect.bottom + 4) + 'px';
                suggestionsDropdown.style.minWidth = rect.width + 'px';
                
                document.body.appendChild(suggestionsDropdown);
            }
            
            suggestionsDropdown.innerHTML = `
                <div class="suggestion-item">
                    <div class="suggestion-label">Suggested full name:</div>
                    <div class="suggestion-value">${this.escapeHtml(formattedSuggestion)}</div>
                </div>
            `;
            
            suggestionsDropdown.querySelector('.suggestion-item').addEventListener('click', () => {
                input.value = formattedSuggestion;
                input.blur();
            });
        };
        
        input.addEventListener('input', showSuggestions);
        
        input.addEventListener('blur', () => {
            if (isEscaping) return;
            
            // Small delay to allow clicking on suggestions
            setTimeout(() => {
                if (suggestionsDropdown) {
                    suggestionsDropdown.remove();
                    suggestionsDropdown = null;
                }
                
                const newValue = input.value;
                const valueToSave = field === this.composerField
                    ? this.formatComposerName(newValue)
                    : newValue;
                if (valueToSave !== currentValue) {
                    this.pushUndo('Edit');
                    row[field] = valueToSave;
                    this.modifiedCount++;
                    this.logChange('Manual edits', 1);
                    this.analyzeData();
                    this.updateStats();
                }
                // Only re-render if no other cell started editing
                if (this.editGeneration === myGeneration) {
                    this.renderTable();
                }
            }, 200);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
                // Move down: edit same field in next visible row
                const idx = this.visibleIds.indexOf(id);
                if (idx !== -1 && idx + 1 < this.visibleIds.length) {
                    const fieldIndex = this.getFieldIndex(field);
                    setTimeout(() => {
                        const tbody = document.getElementById('tableBody');
                        const nextRow = tbody && tbody.children[idx + 1];
                        if (nextRow) {
                            const cells = nextRow.querySelectorAll('td[data-editable="true"]');
                            if (cells[fieldIndex]) cells[fieldIndex].click();
                        }
                    }, 50);
                }
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                input.blur();
                const fields = [this.titleField, this.composerField, this.genreField, this.tagsField];
                const curIdx = fields.indexOf(field);
                const nextFieldIdx = e.shiftKey
                    ? (curIdx > 0 ? curIdx - 1 : fields.length - 1)
                    : (curIdx < fields.length - 1 ? curIdx + 1 : 0);
                setTimeout(() => {
                    const tbody = document.getElementById('tableBody');
                    const visIdx = this.visibleIds.indexOf(id);
                    const row = tbody && tbody.children[visIdx];
                    if (row) {
                        const cells = row.querySelectorAll('td[data-editable="true"]');
                        if (cells[nextFieldIdx]) cells[nextFieldIdx].click();
                    }
                }, 50);
            }
            if (e.key === 'Escape') {
                isEscaping = true;
                if (suggestionsDropdown) {
                    suggestionsDropdown.remove();
                    suggestionsDropdown = null;
                }
                this.renderTable();
            }
        });

        cell.textContent = '';
        cell.appendChild(input);
        input.focus();
        input.select();
        
        // Show suggestions immediately if there's already a value
        showSuggestions();
    },

    filterTable(query) {
        this.currentFilter = query || '';
        this.renderTable();
    },

    clearSearch() {
        const input = document.getElementById('searchInput');
        input.value = '';
        this.filterTable('');
        document.getElementById('searchClear').classList.add('hidden');
        input.focus();
    },

    sortBy(field) {
        if (!field) return;

        if (this.sortColumn === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = field;
            this.sortDirection = 'asc';
        }

        this.renderTable();
    },

    mobileSortChanged(value) {
        if (!value) {
            this.sortColumn = null;
            this.sortDirection = 'asc';
        } else {
            const fieldMap = {
                title: this.titleField,
                composer: this.composerField,
                genre: this.genreField,
                tags: this.tagsField
            };
            const [key, dir] = value.split('-');
            this.sortColumn = fieldMap[key];
            this.sortDirection = dir;
        }
        this.renderTable();
    },

    getFieldIndex(field) {
        const fields = [this.titleField, this.composerField, this.genreField, this.tagsField];
        return fields.indexOf(field);
    },

    toggleRow(id, event) {
        if (event && event.shiftKey && this.lastToggled !== null && this.lastToggled !== id) {
            const start = this.visibleIds.indexOf(this.lastToggled);
            const end = this.visibleIds.indexOf(id);
            if (start !== -1 && end !== -1) {
                const lo = Math.min(start, end);
                const hi = Math.max(start, end);
                for (let i = lo; i <= hi; i++) {
                    this.selectedIds.add(this.visibleIds[i]);
                }
            }
        } else {
            if (this.selectedIds.has(id)) {
                this.selectedIds.delete(id);
            } else {
                this.selectedIds.add(id);
            }
        }
        this.lastToggled = id;
        this.updateBulkControls();
        this.renderTable();
    },

    toggleSelectAll() {
        const selectAllCheckbox = document.getElementById('selectAll');
        if (selectAllCheckbox.checked) {
            // Select only visible rows
            this.visibleIds.forEach(id => this.selectedIds.add(id));
        } else {
            this.visibleIds.forEach(id => this.selectedIds.delete(id));
        }
        this.updateBulkControls();
        this.renderTable();
    },

    updateBulkControls() {
        const bulkControls = document.getElementById('bulkControls');
        const selectedCount = document.getElementById('selectedCount');
        
        selectedCount.textContent = this.selectedIds.size;
        
        if (this.selectedIds.size > 0) {
            bulkControls.classList.add('active');
        } else {
            bulkControls.classList.remove('active');
        }
    },

    getTargetIds() {
        if (this.selectedIds.size > 0) {
            return [...this.selectedIds];
        }
        return [...this.visibleIds];
    },

    getScopeLabel() {
        if (this.selectedIds.size > 0) {
            return `${this.selectedIds.size} selected`;
        }
        if (this.currentFilter && this.visibleIds.length < this.data.length) {
            return `${this.visibleIds.length} filtered`;
        }
        return `all ${this.data.length}`;
    },

    updateScopeIndicator() {
        const el = document.getElementById('scopeIndicator');
        if (!el) return;

        const total = this.data.length;
        const visible = this.visibleIds.length;
        const selected = this.selectedIds.size;

        if (selected > 0) {
            el.innerHTML = `<span class="scope-highlight">${selected} selected</span> of ${total}`;
        } else if (this.currentFilter && visible < total) {
            el.textContent = `${visible} of ${total} shown`;
        } else {
            el.textContent = `${total} scores`;
        }
    },

    clearSelection() {
        this.selectedIds.clear();
        this.updateBulkControls();
        this.renderTable();
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

    showExtractionModal() {
        const modal = document.getElementById('extractionModal');
        const resultsDiv = document.getElementById('extractionResults');
        const descEl = document.getElementById('extractionDesc');

        // Initialize all as selected
        this.selectedExtractions = new Set(this.pendingExtraction.map((_, i) => i));

        // Update description based on result types
        const tc = this.extractionCounts.titleCount;
        const cc = this.extractionCounts.completionCount;
        if (tc > 0 && cc > 0) {
            descEl.innerHTML = `Found <strong>${this.pendingExtraction.length}</strong> composer suggestions (${tc} from titles, ${cc} name completion${cc !== 1 ? 's' : ''}).`;
        } else if (cc > 0) {
            descEl.innerHTML = `Found <strong>${cc}</strong> incomplete composer name${cc !== 1 ? 's' : ''}.`;
        } else {
            descEl.innerHTML = `Found <strong>${tc}</strong> composer name${tc !== 1 ? 's' : ''}.`;
        }

        this.updateExtractionSelectedCount();

        let html = '';

        // Section headers only when both types present
        if (tc > 0 && cc > 0) {
            html += `<div class="extraction-section-header">Extracted from Titles (${tc})</div>`;
        }

        this.pendingExtraction.forEach((e, index) => {
            // Insert completion section header before first completion item
            if (tc > 0 && cc > 0 && e.type === 'completion' && index === tc) {
                html += `<div class="extraction-section-header">Incomplete Composer Names (${cc})</div>`;
            }

            const titleDisplay = this.escapeHtml(e.title.substring(0, 60)) + (e.title.length > 60 ? '...' : '');
            const itemClass = e.type === 'completion' ? 'extraction-item extraction-item--completion' : 'extraction-item';

            html += `
                <div class="${itemClass}">
                    <input type="checkbox" class="extraction-checkbox"
                           id="extract_${index}"
                           onchange="app.toggleExtraction(${index})"
                           checked>
                    <div class="extraction-content">
                        <div class="extraction-title">${titleDisplay}</div>
                        <div class="extraction-mapping">
                            "${this.escapeHtml(e.extracted)}"<span class="extraction-arrow">\u2192</span><strong>${this.escapeHtml(this.formatComposerName(e.suggestion) || e.suggestion)}</strong>
                        </div>
                    </div>
                </div>
            `;
        });

        resultsDiv.innerHTML = html;
        modal.classList.add('active');
    },

    toggleExtraction(index) {
        if (this.selectedExtractions.has(index)) {
            this.selectedExtractions.delete(index);
        } else {
            this.selectedExtractions.add(index);
        }
        this.updateExtractionSelectedCount();
        this.updateSelectAllCheckbox();
    },

    toggleSelectAllExtractions() {
        const selectAllCheckbox = document.getElementById('selectAllExtractions');
        
        if (selectAllCheckbox.checked) {
            // Select all
            this.selectedExtractions = new Set(this.pendingExtraction.map((_, i) => i));
            this.pendingExtraction.forEach((_, index) => {
                document.getElementById(`extract_${index}`).checked = true;
            });
        } else {
            // Deselect all
            this.selectedExtractions.clear();
            this.pendingExtraction.forEach((_, index) => {
                document.getElementById(`extract_${index}`).checked = false;
            });
        }
        this.updateExtractionSelectedCount();
    },

    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('selectAllExtractions');
        if (this.selectedExtractions.size === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (this.selectedExtractions.size === this.pendingExtraction.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    },

    updateExtractionSelectedCount() {
        const selectedCountSpan = document.getElementById('extractionSelectedCount');
        const count = this.selectedExtractions.size;
        if (count === this.pendingExtraction.length) {
            selectedCountSpan.textContent = 'All selected';
        } else if (count === 0) {
            selectedCountSpan.textContent = 'None selected';
        } else {
            selectedCountSpan.textContent = `${count} selected`;
        }
    },

    closeExtractionModal() {
        document.getElementById('extractionModal').classList.remove('active');
        this.pendingExtraction = null;
        this.selectedExtractions = null;
        this.extractionCounts = null;
    },

    applyExtraction() {
        if (!this.pendingExtraction || !this.selectedExtractions) return;
        
        if (this.selectedExtractions.size === 0) {
            this.showNotification('Please select at least one extraction to apply');
            return;
        }
        
        this.pushUndo('Smart Extract');
        let count = 0;
        this.selectedExtractions.forEach(index => {
            const extraction = this.pendingExtraction[index];
            const formatted = this.formatComposerName(extraction.suggestion);
            this.dataById.get(extraction.id)[this.composerField] = formatted || extraction.suggestion;
            this.modifiedCount++;
            count++;
        });
        
        this.logChange('Composers extracted/completed', count);
        this.closeExtractionModal();
        this.analyzeData();
        this.renderAll();

        this.showNotification(`Applied ${count} composer${count !== 1 ? 's' : ''}!`);
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

    showNotification(message) {
        this._notificationQueue.push(message);
        if (!this._notificationActive) this._drainNotificationQueue();
    },

    _drainNotificationQueue() {
        if (this._notificationQueue.length === 0) {
            this._notificationActive = false;
            return;
        }
        this._notificationActive = true;
        const message = this._notificationQueue.shift();

        const notification = document.createElement('div');
        notification.className = 'toast-notification';

        const msgSpan = document.createElement('span');
        msgSpan.className = 'toast-message';
        msgSpan.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.setAttribute('aria-label', 'Dismiss notification');
        closeBtn.textContent = '×';

        notification.appendChild(msgSpan);
        notification.appendChild(closeBtn);
        document.body.appendChild(notification);

        let dismissTimer;
        const dismiss = () => {
            clearTimeout(dismissTimer);
            notification.classList.add('toast-exit');
            notification.addEventListener('animationend', () => {
                notification.remove();
                this._drainNotificationQueue();
            }, { once: true });
        };

        const startTimer = () => { dismissTimer = setTimeout(dismiss, 4000); };
        startTimer();

        notification.addEventListener('mouseenter', () => clearTimeout(dismissTimer));
        notification.addEventListener('mouseleave', startTimer);
        closeBtn.addEventListener('click', dismiss);
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

    showImslpModal() {
        const modal = document.getElementById('imslpModal');
        const resultsDiv = document.getElementById('imslpResults');
        const countSpan = document.getElementById('imslpCount');

        // Preserve label checkbox and selection state across re-renders
        const addLabelEl = document.getElementById('imslpAddLabel');
        const addLabel = addLabelEl ? addLabelEl.checked : true;
        const existingSelections = this.selectedImslpCleanups;

        if (!existingSelections || existingSelections.size === 0) {
            this.selectedImslpCleanups = new Set(this.pendingImslpCleanup.map((_, i) => i));
        }

        countSpan.textContent = this.pendingImslpCleanup.length;
        this.updateImslpSelectedCount();

        let html = '';
        this.pendingImslpCleanup.forEach((item, index) => {
            const isChecked = this.selectedImslpCleanups.has(index) ? 'checked' : '';
            html += `
                <div class="extraction-item">
                    <input type="checkbox" class="extraction-checkbox"
                           id="imslp_${index}"
                           onchange="app.toggleImslpCleanup(${index})"
                           ${isChecked}>
                    <div class="extraction-content">
                        <div class="extraction-title">Original: ${this.escapeHtml(item.original.substring(0, 60))}${item.original.length > 60 ? '...' : ''}</div>
                        <div class="extraction-mapping">
                            <span class="extraction-arrow">→</span><strong>${this.escapeHtml(item.cleaned)}</strong>
                        </div>
                    </div>
                </div>
            `;
        });

        resultsDiv.innerHTML = html;
        modal.classList.add('active');

        // Restore label checkbox state after rendering
        document.getElementById('imslpAddLabel').checked = addLabel;
        this.updateImslpSelectAllCheckbox();
    },

    toggleImslpCleanup(index) {
        if (this.selectedImslpCleanups.has(index)) {
            this.selectedImslpCleanups.delete(index);
        } else {
            this.selectedImslpCleanups.add(index);
        }
        this.updateImslpSelectedCount();
        this.updateImslpSelectAllCheckbox();
    },

    toggleImslpLabel() {
        const addLabel = document.getElementById('imslpAddLabel').checked;
        this.pendingImslpCleanup.forEach(item => {
            item.cleaned = this.cleanImslpTitle(item.original, addLabel);
        });
        this.showImslpModal();
    },

    toggleSelectAllImslp() {
        const selectAllCheckbox = document.getElementById('selectAllImslp');
        
        if (selectAllCheckbox.checked) {
            // Select all
            this.selectedImslpCleanups = new Set(this.pendingImslpCleanup.map((_, i) => i));
            this.pendingImslpCleanup.forEach((_, index) => {
                document.getElementById(`imslp_${index}`).checked = true;
            });
        } else {
            // Deselect all
            this.selectedImslpCleanups.clear();
            this.pendingImslpCleanup.forEach((_, index) => {
                document.getElementById(`imslp_${index}`).checked = false;
            });
        }
        this.updateImslpSelectedCount();
    },

    updateImslpSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('selectAllImslp');
        if (this.selectedImslpCleanups.size === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (this.selectedImslpCleanups.size === this.pendingImslpCleanup.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    },

    updateImslpSelectedCount() {
        const selectedCountSpan = document.getElementById('imslpSelectedCount');
        const count = this.selectedImslpCleanups.size;
        if (count === this.pendingImslpCleanup.length) {
            selectedCountSpan.textContent = 'All selected';
        } else if (count === 0) {
            selectedCountSpan.textContent = 'None selected';
        } else {
            selectedCountSpan.textContent = `${count} selected`;
        }
    },

    closeImslpModal() {
        document.getElementById('imslpModal').classList.remove('active');
        this.pendingImslpCleanup = null;
        this.selectedImslpCleanups = null;
    },

    applyImslpCleanup() {
        if (!this.pendingImslpCleanup || !this.selectedImslpCleanups) return;
        
        if (this.selectedImslpCleanups.size === 0) {
            this.showNotification('Please select at least one title to clean');
            return;
        }
        
        this.pushUndo('Clean IMSLP');
        let count = 0;
        this.selectedImslpCleanups.forEach(index => {
            const cleanup = this.pendingImslpCleanup[index];
            this.dataById.get(cleanup.id)[this.titleField] = cleanup.cleaned;
            this.modifiedCount++;
            count++;
        });
        
        this.logChange('IMSLP titles cleaned', count);
        this.closeImslpModal();
        this.analyzeData();
        this.renderAll();

        this.showNotification(`Cleaned ${count} title${count !== 1 ? 's' : ''}!`);
    },

    findReplace() {
        document.getElementById('findReplaceModal').classList.add('active');
    },

    closeModal() {
        document.getElementById('findReplaceModal').classList.remove('active');
    },

    executeReplace() {
        const find = document.getElementById('findText').value;
        const replace = document.getElementById('replaceText').value;
        const fieldType = document.getElementById('replaceField').value;

        if (!find) return;

        let actualField;
        switch(fieldType) {
            case 'composer': actualField = this.composerField; break;
            case 'title': actualField = this.titleField; break;
            case 'genre': actualField = this.genreField; break;
            case 'tags': actualField = this.tagsField; break;
        }

        if (!actualField) {
            this.showNotification(`Field "${fieldType}" not found in your CSV`);
            return;
        }

        const targetIndices = this.getTargetIds();
        const changes = [];

        targetIndices.forEach(idx => {
            const row = this.dataById.get(idx);
            if (row[actualField] && row[actualField].includes(find)) {
                const oldVal = row[actualField];
                const newVal = oldVal.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace);
                if (oldVal !== newVal) {
                    changes.push({
                        id: idx,
                        label: `Row ${idx + 1}: ${actualField}`,
                        detail: oldVal,
                        newDetail: newVal,
                        field: actualField,
                        newVal
                    });
                }
            }
        });

        if (changes.length === 0) {
            this.showNotification('No matches found.');
            return;
        }

        this.closeModal();
        this._showPreview('Find & Replace Preview', `Found <strong>${changes.length}</strong> match${changes.length !== 1 ? 'es' : ''}.`, changes, 'Find & replace edits', 'Find & Replace');
    },

    quickClean() {
        const targetIndices = this.getTargetIds();
        const changes = [];

        targetIndices.forEach(idx => {
            const row = this.dataById.get(idx);
            const rowChanges = [];

            if (this.composerField) {
                const composer = row[this.composerField] || '';
                let result = composer.trim();
                if (result && result.includes(',') && result.split(',')[1].trim() === '') {
                    result = result.replace(/,\s*$/, '');
                }
                if (result !== composer) {
                    rowChanges.push({ field: this.composerField, newVal: result, desc: 'composer trimmed' });
                }
            }
            if (this.titleField) {
                const title = row[this.titleField] || '';
                const trimmed = title.trim();
                if (trimmed !== title) {
                    rowChanges.push({ field: this.titleField, newVal: trimmed, desc: 'title trimmed' });
                }
            }
            if (this.tagsField) {
                const raw = row[this.tagsField] || '';
                if (raw) {
                    let tags = raw.split(';').map(t => t.trim()).filter(t => t.length > 0);
                    const seen = new Map();
                    const deduped = [];
                    tags.forEach(tag => {
                        const lower = tag.toLowerCase();
                        if (!seen.has(lower)) {
                            seen.set(lower, tag);
                            deduped.push(tag);
                        }
                    });
                    deduped.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
                    const cleaned = deduped.join(';');
                    if (cleaned !== raw) {
                        rowChanges.push({ field: this.tagsField, newVal: cleaned, desc: 'tags tidied' });
                    }
                }
            }

            rowChanges.forEach(c => {
                const titleVal = this.titleField ? (row[this.titleField] || '').trim() : '';
                changes.push({
                    id: idx,
                    label: `Row ${idx + 1}: ${titleVal || '(untitled)'}`,
                    detail: row[c.field] || '',
                    newDetail: c.newVal,
                    field: c.field,
                    newVal: c.newVal
                });
            });
        });

        if (changes.length === 0) {
            this.showNotification('Already clean! No issues found.');
            return;
        }

        this._showPreview('Quick Clean Preview', `Found <strong>${changes.length}</strong> field${changes.length !== 1 ? 's' : ''} to clean.`, changes, 'Whitespace, commas & tags cleaned', 'Quick Clean');
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

    _showPreview(title, desc, changes, logCategory, undoLabel) {
        this._previewChanges = changes;
        this._previewSelected = new Set(changes.map((_, i) => i));
        this._previewLogCategory = logCategory;
        this._previewUndoLabel = undoLabel;

        document.getElementById('previewModalTitle').textContent = title;
        document.getElementById('previewModalDesc').innerHTML = desc;

        const maxShow = 200;
        const toShow = changes.slice(0, maxShow);
        let html = '';
        toShow.forEach((c, i) => {
            const oldEsc = this.escapeHtml(c.detail || '');
            const newEsc = this.escapeHtml(c.newDetail || '');
            html += `<div class="preview-row">
                <input type="checkbox" checked onchange="app.togglePreviewItem(${i})">
                <div class="preview-row-content">
                    <div class="preview-row-label">${this.escapeHtml(c.label)}</div>
                    <div class="preview-row-detail">
                        <span class="diff-old">${oldEsc || '(empty)'}</span>
                        <span class="diff-arrow">&rarr;</span>
                        <span class="diff-new">${newEsc || '(empty)'}</span>
                    </div>
                </div>
            </div>`;
        });
        if (changes.length > maxShow) {
            html += `<div class="preview-summary">&hellip; and ${changes.length - maxShow} more changes</div>`;
        }

        document.getElementById('previewList').innerHTML = html;
        document.getElementById('previewSelectAll').checked = true;
        document.getElementById('previewApplyBtn').textContent = `Apply ${changes.length} Change${changes.length !== 1 ? 's' : ''}`;
        document.getElementById('previewModal').classList.add('active');
    },

    togglePreviewItem(i) {
        if (this._previewSelected.has(i)) {
            this._previewSelected.delete(i);
        } else {
            this._previewSelected.add(i);
        }
        document.getElementById('previewSelectAll').checked = this._previewSelected.size === this._previewChanges.length;
        document.getElementById('previewApplyBtn').textContent = `Apply ${this._previewSelected.size} Change${this._previewSelected.size !== 1 ? 's' : ''}`;
    },

    toggleAllPreviewItems() {
        const all = document.getElementById('previewSelectAll').checked;
        const checkboxes = document.querySelectorAll('#previewList input[type="checkbox"]');
        if (all) {
            this._previewSelected = new Set(this._previewChanges.map((_, i) => i));
            checkboxes.forEach(cb => cb.checked = true);
        } else {
            this._previewSelected = new Set();
            checkboxes.forEach(cb => cb.checked = false);
        }
        document.getElementById('previewApplyBtn').textContent = `Apply ${this._previewSelected.size} Change${this._previewSelected.size !== 1 ? 's' : ''}`;
    },

    closePreviewModal() {
        document.getElementById('previewModal').classList.remove('active');
    },

    applyPreviewChanges() {
        const selected = this._previewSelected;
        if (selected.size === 0) {
            this.showNotification('No changes selected.');
            return;
        }

        this.pushUndo(this._previewUndoLabel);
        let count = 0;

        selected.forEach(i => {
            const c = this._previewChanges[i];
            if (c) {
                const newValue = c.field === this.composerField
                    ? this.formatComposerName(c.newVal)
                    : c.newVal;
                this.dataById.get(c.id)[c.field] = newValue;
                count++;
            }
        });

        this.modifiedCount += count;
        this.logChange(this._previewLogCategory, count);
        this.closePreviewModal();
        this.analyzeData();
        this.renderAll();
        this.showNotification(`Applied ${count} change${count !== 1 ? 's' : ''}.`);
    },

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

    showHelp() {
        document.getElementById('helpModal').classList.add('active');
    },

    closeHelp() {
        document.getElementById('helpModal').classList.remove('active');
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

    exportCSV() {
        if (this.modifiedCount === 0) {
            this.doExport();
            return;
        }

        const modal = document.getElementById('exportModal');
        const desc = document.getElementById('exportSummaryDesc');
        const list = document.getElementById('exportSummaryList');

        desc.innerHTML = `<strong>${this.modifiedCount}</strong> field${this.modifiedCount !== 1 ? 's' : ''} modified across <strong>${this.data.length}</strong> scores.`;

        if (this.changeLog.length > 0) {
            let html = '';
            this.changeLog.forEach(c => {
                html += `<div style="display:flex;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--color-border-light);font-size:14px;">
                    <span>${c.category}</span>
                    <strong>${c.count}</strong>
                </div>`;
            });
            list.innerHTML = html;
            list.style.display = '';
        } else {
            list.style.display = 'none';
        }

        // Compute diff for diff view
        this._exportDiffs = [];
        const fields = this.headers;
        this.data.forEach(row => {
            const orig = this.originalData[row.__id];
            if (!orig) return;
            fields.forEach(field => {
                const oldVal = orig[field] || '';
                const newVal = row[field] || '';
                if (oldVal !== newVal) {
                    this._exportDiffs.push({ rowNum: row.__id + 1, field, oldVal, newVal });
                }
            });
        });

        // Show/hide diff toggle
        const diffToggle = document.getElementById('diffToggle');
        const diffContainer = document.getElementById('diffContainer');
        if (this._exportDiffs.length > 0) {
            diffToggle.style.display = '';
            diffToggle.classList.remove('expanded');
            document.getElementById('diffToggleLabel').textContent = `Show all changes (${this._exportDiffs.length})`;
            diffContainer.style.display = 'none';
            diffContainer.innerHTML = '';
        } else {
            diffToggle.style.display = 'none';
            diffContainer.style.display = 'none';
        }

        modal.classList.add('active');
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

    closeExportModal() {
        document.getElementById('exportModal').classList.remove('active');
    },

    doExport() {
        this.closeExportModal();
        const headers = this.headers.filter(h => h !== '__id');

        let csv = headers.join(',') + '\n';

        this.data.forEach(row => {
            const values = headers.map(header => {
                const value = row[header] || '';
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    return '"' + value.replace(/"/g, '""') + '"';
                }
                return value;
            });
            csv += values.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tidyscore-export.csv';
        a.click();
        URL.revokeObjectURL(url);
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

    reset() {
        // Simple double-click protection without using confirm()
        if (!this.resetClickTime || Date.now() - this.resetClickTime > 3000) {
            this.resetClickTime = Date.now();
            this.showNotification('Click "Start Over" again within 3 seconds to confirm reset');
            return;
        }
        
        this.data = [];
        this.originalData = [];
        this.dataById = new Map();
        this.modifiedCount = 0;
        this.undoStack = [];
        this.changeLog = [];
        this.selectedIds.clear();
        this.resetClickTime = null;
        
        document.getElementById('uploadSection').classList.remove('hidden');
        document.getElementById('samplePrompt').classList.remove('hidden');
        document.getElementById('helpLink').classList.remove('hidden');
        document.getElementById('privacyNote').classList.remove('hidden');
        document.getElementById('statsSection').classList.add('hidden');
        document.getElementById('tableSection').classList.add('hidden');
    }
};

export default app;
