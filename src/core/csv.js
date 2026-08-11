import Papa from 'papaparse';
import { buildExportReviewSummary, detectFormulaRisks, resolveLibraryFields } from './data-model.js';
import { assignRowIds, buildRowsById, cloneRowsWithIds } from './row-identity.js';

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
export const VALIDATED_ROW_TARGET = 5000;
export const MAX_IMPORT_ROWS = 25000;

export function getTextByteLength(text) {
    return new TextEncoder().encode(text).byteLength;
}

export function parseCsvDocument(text) {
    if (typeof text !== 'string' || !text.trim()) {
        throw new Error('No data found in CSV. Please check the file format.');
    }

    const parsed = Papa.parse(text, {
        delimiter: ',',
        skipEmptyLines: 'greedy'
    });

    if (parsed.errors.length > 0) {
        const firstError = parsed.errors[0];
        const rowLabel = Number.isInteger(firstError.row) ? ` on row ${firstError.row + 1}` : '';
        throw new Error(`Invalid CSV${rowLabel}: ${firstError.message}`);
    }

    if (parsed.data.length < 2) {
        throw new Error('No data found in CSV. Please check the file format.');
    }

    const headers = parsed.data[0].map((value, index) => {
        const header = String(value ?? '').replace(/^\uFEFF/, '').trim();
        if (!header) throw new Error(`Invalid CSV: column ${index + 1} has no header.`);
        return header;
    });

    if (new Set(headers).size !== headers.length) {
        throw new Error('Invalid CSV: duplicate column headers are not supported.');
    }

    const rows = parsed.data.slice(1).map((values, index) => {
        if (values.length !== headers.length) {
            throw new Error(
                `Invalid CSV on row ${index + 2}: expected ${headers.length} columns but found ${values.length}.`
            );
        }

        return Object.fromEntries(headers.map((header, columnIndex) => [
            header,
            String(values[columnIndex] ?? '')
        ]));
    });

    return { headers, rows };
}

export function serializeCsvDocument(headers, rows) {
    return Papa.unparse({
        fields: headers,
        data: rows.map(row => headers.map(header => String(row[header] ?? '')))
    }, {
        newline: '\r\n'
    });
}

export function buildExportFilename(sourceFileName = 'forscore-library.csv', date = new Date()) {
    const sourceBase = sourceFileName.replace(/\.csv$/i, '')
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'forscore-library';
    const dateStamp = date.toISOString().slice(0, 10);
    return `${sourceBase}-tidyscore-${dateStamp}.csv`;
}

export function canShareFile(navigatorLike, file) {
    if (!navigatorLike || typeof navigatorLike.share !== 'function' || typeof navigatorLike.canShare !== 'function') return false;
    try {
        return navigatorLike.canShare({ files: [file] });
    } catch (_) {
        return false;
    }
}

export const SAMPLE_LIBRARY_CSV = [
    'Title,Composers,Genre,Tags,Filename',
    'Bach - Cello Suite No. 1 in G Major,,Baroque,cello,Bach - Cello Suite No.1 in G Major.pdf',
    'Prelude in C Major,bach,Baroque,piano;keyboard,Bach - Prelude in C Major BWV 846.pdf',
    'Moonlight Sonata,beethoven,Classical,piano,Moonlight Sonata.pdf',
    'Moonlight Sonata (2),"Beethoven, Ludwig van",Classical,piano,Moonlight Sonata copy.pdf',
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
    'Prokofiev: Dance of the Knights,,20th Century,orchestra,Prokofiev: Dance of the Knights.pdf',
    '"Intermezzo for Piano, Op. 118 No. 2",Johannes Brahms,Romantic,piano,Intermezzo piano op 118 no 2.pdf',
    '"Intermezzo, Op. 118 No. 2",brahms,Romantic,piano,Intermezzo alternate scan.pdf',
    'Academic Festival Overture Full Score,Johannes Brahms,Romantic,orchestra,Academic Festival Overture score.pdf',
    'Academic Festival Overture Violin Part,Johannes Brahms,Romantic,violin;orchestra,Academic Festival Overture violin part.pdf',
    'Brahms and Beethoven - Variations,,,piano,Brahms Beethoven Variations.pdf',
    'C.P.E. Bach and J.S. Bach - Two Bachs,,Baroque,keyboard,CPE and JS Bach.pdf',
    'Piano Miniatures Brahms Kapustin Beethoven,,,piano,Brahms Kapustin Beethoven Miniatures.pdf',
    'Slavonic Dances,"Antonin Dvorak, Johannes Brahms",Romantic,piano;four hands,Slavonic Dances four hands.pdf'
].join('\n');

export const csvCore = {
    handleFile(file) {
        this._fileReadGeneration = (this._fileReadGeneration || 0) + 1;
        const generation = this._fileReadGeneration;
        if (this._activeFileReader && this._activeFileReader.readyState === globalThis.FileReader?.LOADING) {
            this._activeFileReader.abort();
        }

        if (!file || !file.name.toLowerCase().endsWith('.csv')) {
            this.showNotification('Please upload a CSV file');
            return { ok: false, code: 'INVALID_FILE_TYPE', message: 'Please upload a CSV file' };
        }
        if (file.size > MAX_IMPORT_BYTES) {
            const message = 'This CSV is larger than the 25 MiB safety limit. The current library was not changed.';
            this.showNotification(message);
            return { ok: false, code: 'FILE_TOO_LARGE', message };
        }

        const reader = new FileReader();
        this._activeFileReader = reader;
        reader.onload = (e) => {
            if (generation !== this._fileReadGeneration) return;
            this._activeFileReader = null;
            this.parseCSV(e.target.result, { sourceFileName: file.name, requestGeneration: generation });
        };
        reader.onerror = () => {
            if (generation !== this._fileReadGeneration) return;
            this._activeFileReader = null;
            this.showNotification('The CSV file could not be read. Please try again.');
        };
        reader.onabort = () => {
            if (generation === this._fileReadGeneration) this._activeFileReader = null;
        };
        reader.readAsText(file);
        return { ok: true, pending: true };
    },

    loadSample() {
        return this.parseCSV(SAMPLE_LIBRARY_CSV, { sourceFileName: 'sample-library.csv' });
    },

    parseCSV(text, { sourceFileName, requestGeneration } = {}) {
        if (requestGeneration == null) {
            this._fileReadGeneration = (this._fileReadGeneration || 0) + 1;
            this._activeFileReader?.abort?.();
            this._activeFileReader = null;
        } else if (requestGeneration !== this._fileReadGeneration) {
            return { ok: false, code: 'STALE_IMPORT', message: 'A newer import has already started.' };
        }

        if (typeof text !== 'string' || getTextByteLength(text) > MAX_IMPORT_BYTES) {
            const message = 'This CSV is larger than the 25 MiB safety limit. The current library was not changed.';
            this.showNotification(message);
            return { ok: false, code: 'TEXT_TOO_LARGE', message };
        }

        let document;
        try {
            document = parseCsvDocument(text);
        } catch (error) {
            const message = error.message || 'Invalid CSV. Please check the file format.';
            this.showNotification(message);
            return { ok: false, code: 'INVALID_CSV', message };
        }

        const fields = resolveLibraryFields(document.headers);
        if (!fields.title && !fields.filename) {
            const message = 'This CSV needs a Title or Filename column. No data was imported.';
            this.showNotification(message);
            return { ok: false, code: 'MISSING_IDENTITY_FIELD', message };
        }
        if (document.rows.length > MAX_IMPORT_ROWS) {
            const message = `This CSV has more than ${MAX_IMPORT_ROWS.toLocaleString()} rows. The current library was not changed.`;
            this.showNotification(message);
            return { ok: false, code: 'ROW_LIMIT_EXCEEDED', message };
        }

        const nextData = assignRowIds(document.rows);
        const nextOriginalData = cloneRowsWithIds(nextData);

        this.finishActiveCellEdit?.({ cancel: true, render: false });
        this.editGeneration = (this.editGeneration || 0) + 1;
        this.data = nextData;
        this.dataById = buildRowsById(nextData);
        this.originalData = nextOriginalData;
        this.originalDataById = buildRowsById(nextOriginalData);
        this.headers = document.headers;
        this.scaleWarning = document.rows.length > VALIDATED_ROW_TARGET
            ? { rowCount: document.rows.length, validatedTarget: VALIDATED_ROW_TARGET }
            : null;
        if (sourceFileName) this.sourceFileName = sourceFileName;
        this.currentFilter = '';
        this.filteredIds = [];
        this.visibleIds = [];
        this.currentPage = 0;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        const searchInput = globalThis.document?.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
        globalThis.document?.getElementById('searchClear')?.classList.add('hidden');
        this.selectedIds.clear();
        this.undoStack = [];
        this.exportReviewCandidates = new Map();
        this.invalidateAnalysis?.({ clearCache: true });
        this.analyzeData();
        this.renderAll();
        return { ok: true };
    },

    analyzeData() {
        const fields = resolveLibraryFields(this.headers);
        this.composerField = fields.composer;
        this.titleField = fields.title;
        this.genreField = fields.genre;
        this.tagsField = fields.tags;
        this.filenameField = fields.filename;
    },

    detectField(possibleNames) {
        for (let name of possibleNames) {
            if (this.headers.includes(name)) {
                return name;
            }
        }
        return null;
    },

    exportCSV() {
        const modal = document.getElementById('exportModal');
        this._exportVisibleGroupCount = 50;
        this.exportSearchQuery = '';
        this.exportExpandedRows = new Set();
        this.renderExportSummary();

        const artifact = this.createExportArtifact();
        const shareButton = document.getElementById('shareExportBtn');
        if (shareButton) shareButton.classList.toggle('hidden', !canShareFile(navigator, artifact.file));

        this.updateWorkflowSteps?.('return');
        this.activateModal(modal);
    },

    renderExportSummary({ preserveScroll = false } = {}) {
        const desc = document.getElementById('exportSummaryDesc');
        const list = document.getElementById('exportSummaryList');
        if (!desc || !list) return;

        const previousScrollTop = preserveScroll ? list.scrollTop : 0;
        if (!(this.exportReviewCandidates instanceof Map)) this.exportReviewCandidates = new Map();
        const summary = buildExportReviewSummary(
            this.data,
            this.originalData,
            this.headers,
            this.exportReviewCandidates
        );
        this._exportDiffSummary = summary;
        const formulaRisk = detectFormulaRisks(this.headers, this.data);
        this._formulaRiskSummary = formulaRisk;
        this.modifiedCount = summary.changedFieldCount;

        if (summary.candidateCount === 0) {
            desc.innerHTML = `No metadata changes are currently selected. You can still export all <strong>${this.data.length}</strong> scores.`;
        } else if (summary.changedFieldCount === 0) {
            desc.innerHTML = `No changes selected for export. <strong>${summary.revertedCount}</strong> change${summary.revertedCount !== 1 ? 's are' : ' is'} using original values.`;
        } else {
            const reverted = summary.revertedCount > 0
                ? ` <strong>${summary.revertedCount}</strong> using original.`
                : '';
            desc.innerHTML = `<strong>${summary.changedFieldCount}</strong> change${summary.changedFieldCount !== 1 ? 's' : ''} selected across <strong>${summary.changedScoreCount}</strong> score${summary.changedScoreCount !== 1 ? 's' : ''}.${reverted}`;
        }

        const breakdown = document.getElementById('exportFieldBreakdown');
        const formulaWarning = document.getElementById('exportFormulaWarning');
        const instruction = document.getElementById('exportRevertInstruction');
        const searchWrapper = document.getElementById('exportSearchWrapper');
        const searchInput = document.getElementById('exportSearchInput');
        const searchClear = document.getElementById('exportSearchClear');
        const searchResults = document.getElementById('exportSearchResults');
        if (breakdown) {
            breakdown.textContent = '';
            Object.entries(summary.fieldCounts).forEach(([field, count]) => {
                const item = document.createElement('span');
                item.className = 'export-field-count';
                item.textContent = `${field} ${count}`;
                breakdown.appendChild(item);
            });
            breakdown.classList.toggle('hidden', summary.changedFieldCount === 0);
        }
        if (formulaWarning) {
            formulaWarning.classList.toggle('hidden', formulaRisk.cellCount === 0);
            formulaWarning.textContent = formulaRisk.cellCount === 0
                ? ''
                : `${formulaRisk.cellCount} cell${formulaRisk.cellCount === 1 ? '' : 's'} across ${formulaRisk.rowCount} row${formulaRisk.rowCount === 1 ? '' : 's'} begin with a spreadsheet formula character. Values will be preserved exactly; review them carefully when opening the CSV.`;
        }
        instruction?.classList.toggle('hidden', summary.candidateCount === 0);
        searchWrapper?.classList.toggle('hidden', summary.candidateCount === 0);
        if (searchInput) searchInput.value = this.exportSearchQuery || '';
        searchClear?.classList.toggle('hidden', !this.exportSearchQuery);

        list.textContent = '';
        if (summary.candidateCount === 0) {
            searchResults?.classList.add('hidden');
            const empty = document.createElement('div');
            empty.className = 'export-empty-state';
            empty.textContent = 'Your export currently matches the imported library.';
            list.appendChild(empty);
            return;
        }

        const query = (this.exportSearchQuery || '').trim().toLowerCase();
        const filteredGroups = query
            ? summary.groups.filter(group => this.exportGroupMatchesSearch(group, query))
            : summary.groups;
        if (searchResults) {
            searchResults.classList.toggle('hidden', !query);
            if (query) {
                searchResults.textContent = `Showing ${filteredGroups.length} of ${summary.groups.length} score${summary.groups.length !== 1 ? 's' : ''}`;
            }
        }

        if (filteredGroups.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'export-empty-state';
            empty.textContent = `No changed scores match “${this.exportSearchQuery.trim()}”.`;
            list.appendChild(empty);
            return;
        }

        const visibleCount = this._exportVisibleGroupCount || 50;
        filteredGroups.slice(0, visibleCount).forEach(group => {
            list.appendChild(this.createExportScoreGroup(group));
        });

        if (filteredGroups.length > visibleCount) {
            const moreButton = document.createElement('button');
            moreButton.type = 'button';
            moreButton.className = 'export-show-more';
            const remaining = filteredGroups.length - visibleCount;
            moreButton.textContent = `Show ${Math.min(50, remaining)} more score${remaining === 1 ? '' : 's'}`;
            moreButton.addEventListener('click', () => this.showMoreExportChanges());
            list.appendChild(moreButton);
        }

        if (preserveScroll) list.scrollTop = previousScrollTop;
    },

    createExportScoreGroup(group) {
        const scoreGroup = document.createElement('section');
        scoreGroup.className = 'export-score-group';
        scoreGroup.dataset.exportRowId = group.rowId;

        const expanded = this.exportExpandedRows?.has(group.rowId) || false;
        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'export-score-header';
        header.setAttribute('aria-expanded', String(expanded));
        header.setAttribute('aria-controls', `exportScoreDetails-${group.rowId}`);
        header.setAttribute('aria-label', `${expanded ? 'Hide' : 'Show'} details for ${group.title}, row ${group.rowNum}`);
        header.addEventListener('click', () => this.toggleExportScoreDetails(group.rowId));
        const heading = document.createElement('span');
        heading.className = 'export-score-heading';
        const title = document.createElement('div');
        title.className = 'export-score-title';
        title.textContent = group.title;
        const meta = document.createElement('div');
        meta.className = 'export-score-meta';
        meta.textContent = `${group.composer} · Row ${group.rowNum}`;
        heading.append(title, meta);
        const detailsAction = document.createElement('span');
        detailsAction.className = 'export-details-action';
        detailsAction.innerHTML = `<span>${expanded ? 'Hide details' : 'Details'}</span><svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 5l4 4 4-4"/></svg>`;
        header.append(heading, detailsAction);
        scoreGroup.appendChild(header);

        if (expanded) scoreGroup.appendChild(this.createExportScoreDetails(group));

        group.changes.forEach(change => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `export-change-row ${change.included ? 'is-included' : 'is-original'}`;
            button.setAttribute('aria-pressed', String(change.included));
            button.setAttribute(
                'aria-label',
                `${change.included ? 'Use original' : 'Use changed'} ${change.field} value for ${group.title}, row ${group.rowNum}`
            );
            button.addEventListener('click', () => this.toggleExportChange(group.rowId, change.field, group.title));

            const field = document.createElement('span');
            field.className = 'export-change-field';
            field.textContent = change.field;
            const values = document.createElement('span');
            values.className = 'export-change-values';
            const oldValue = document.createElement('span');
            oldValue.className = 'export-change-old';
            oldValue.textContent = change.oldValue || '(empty)';
            const arrow = document.createElement('span');
            arrow.className = 'export-change-arrow';
            arrow.setAttribute('aria-hidden', 'true');
            arrow.textContent = '→';
            const newValue = document.createElement('span');
            newValue.className = 'export-change-new';
            newValue.textContent = change.newValue || '(empty)';
            values.append(oldValue, arrow, newValue);

            const action = document.createElement('span');
            action.className = 'export-change-action';
            action.innerHTML = change.included
                ? '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M5 8l2 2 4-4"/></svg><span>Using change</span>'
                : '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M5 8h6"/></svg><span>Using original</span>';
            button.append(field, values, action);
            scoreGroup.appendChild(button);
        });

        return scoreGroup;
    },

    createExportScoreDetails(group) {
        const details = document.createElement('div');
        details.id = `exportScoreDetails-${group.rowId}`;
        details.className = 'export-score-details';
        const heading = document.createElement('div');
        heading.className = 'export-details-heading';
        heading.textContent = 'Current export values';
        details.appendChild(heading);

        const grid = document.createElement('dl');
        grid.className = 'export-details-grid';
        [
            ['Title', group.details.title],
            ['Composer', group.details.composer],
            ['Genre', group.details.genre],
            ['Tags', group.details.tags]
        ].forEach(([label, value]) => {
            const term = document.createElement('dt');
            term.textContent = label;
            const description = document.createElement('dd');
            description.textContent = value === null ? 'Not in CSV' : (value || '(empty)');
            grid.append(term, description);
        });
        details.appendChild(grid);
        return details;
    },

    toggleExportScoreDetails(rowId) {
        if (!(this.exportExpandedRows instanceof Set)) this.exportExpandedRows = new Set();
        if (this.exportExpandedRows.has(rowId)) {
            this.exportExpandedRows.delete(rowId);
        } else {
            this.exportExpandedRows.add(rowId);
        }
        this.renderExportSummary({ preserveScroll: true });
        requestAnimationFrame(() => {
            document.querySelector(`[data-export-row-id="${rowId}"] .export-score-header`)?.focus();
        });
    },

    exportGroupMatchesSearch(group, query) {
        const details = Object.values(group.details || {}).filter(value => value !== null);
        const changes = group.changes.flatMap(change => [change.field, change.oldValue, change.newValue]);
        return [group.title, group.composer, `row ${group.rowNum}`, ...details, ...changes]
            .join(' ')
            .toLowerCase()
            .includes(query);
    },

    filterExportSummary(query) {
        this.exportSearchQuery = query || '';
        this._exportVisibleGroupCount = 50;
        this.renderExportSummary({ preserveScroll: false });
    },

    clearExportSearch() {
        this.exportSearchQuery = '';
        this._exportVisibleGroupCount = 50;
        this.renderExportSummary({ preserveScroll: false });
        document.getElementById('exportSearchInput')?.focus();
    },

    showMoreExportChanges() {
        this._exportVisibleGroupCount = (this._exportVisibleGroupCount || 50) + 50;
        this.renderExportSummary({ preserveScroll: true });
    },

    toggleExportChange(rowId, field, title) {
        const row = this.dataById.get(rowId);
        const candidate = this.exportReviewCandidates?.get(`${rowId}\u0000${field}`);
        if (!row || !candidate) return;

        const usingChange = String(row[field] ?? '') === candidate.proposedValue;
        this.pushUndo(`${usingChange ? 'Use original' : 'Use change'} for ${field}`, {
            type: 'export-toggle',
            field,
            title
        });
        row[field] = usingChange ? candidate.originalValue : candidate.proposedValue;
        this.analyzeData();
        this.updateStats();
        this.renderTable();
        this.updateWorkflowSteps?.('return');
        this.renderExportSummary({ preserveScroll: true });
    },

    createExportArtifact() {
        const headers = [...this.headers];
        const csv = serializeCsvDocument(headers, this.data);
        const filename = buildExportFilename(this.sourceFileName);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const file = typeof File === 'function' ? new File([blob], filename, { type: 'text/csv' }) : blob;
        return { csv, filename, blob, file };
    },

    downloadExport() {
        const { blob, filename } = this.createExportArtifact();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        this.showExportComplete(filename);
    },

    doExport() {
        this.downloadExport();
    },

    async shareExport() {
        const artifact = this.createExportArtifact();
        if (!canShareFile(navigator, artifact.file)) {
            this.downloadExport();
            return;
        }

        try {
            await navigator.share({
                files: [artifact.file],
                title: 'TidyScore cleaned forScore library',
                text: 'Cleaned forScore metadata CSV'
            });
            this.showExportComplete(artifact.filename);
        } catch (error) {
            if (error?.name !== 'AbortError') {
                this.showNotification('Sharing was unavailable. Use “Save to Files” instead.');
            }
        }
    },

    showExportComplete(filename) {
        this.closeExportModal();
        const filenameElement = document.getElementById('exportCompleteFilename');
        if (filenameElement) filenameElement.textContent = filename;
        this.updateWorkflowSteps?.('return');
        this.activateModal(document.getElementById('exportCompleteModal'));
    },

    closeExportCompleteModal() {
        document.getElementById('exportCompleteModal').classList.remove('active');
    },
};
