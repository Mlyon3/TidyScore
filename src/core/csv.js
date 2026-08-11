import Papa from 'papaparse';
import { buildExportReviewSummary, resolveLibraryFields } from './data-model.js';

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

export const csvCore = {
    handleFile(file) {
        if (!file || !file.name.toLowerCase().endsWith('.csv')) {
            this.showNotification('Please upload a CSV file');
            return;
        }

        this.sourceFileName = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.parseCSV(e.target.result);
        };
        reader.onerror = () => {
            this.showNotification('The CSV file could not be read. Please try again.');
        };
        reader.readAsText(file);
    },

    loadSample() {
        this.sourceFileName = 'sample-library.csv';
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
        let document;
        try {
            document = parseCsvDocument(text);
        } catch (error) {
            this.showNotification(error.message || 'Invalid CSV. Please check the file format.');
            return;
        }

        const fields = resolveLibraryFields(document.headers);
        if (!fields.title && !fields.filename) {
            this.showNotification('This CSV needs a Title or Filename column. No data was imported.');
            return;
        }

        this.data = document.rows;
        this.data.forEach((row, i) => { row.__id = i; });
        this.dataById = new Map(this.data.map(row => [row.__id, row]));
        this.originalData = JSON.parse(JSON.stringify(this.data));
        this.headers = document.headers;
        this.selectedIds.clear();
        this.undoStack = [];
        this.exportReviewCandidates = new Map();
        this.analyzeData();
        this.renderAll();
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
        const instruction = document.getElementById('exportRevertInstruction');
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
        instruction?.classList.toggle('hidden', summary.candidateCount === 0);

        list.textContent = '';
        if (summary.candidateCount === 0) {
            const empty = document.createElement('div');
            empty.className = 'export-empty-state';
            empty.textContent = 'Your export currently matches the imported library.';
            list.appendChild(empty);
            return;
        }

        const visibleCount = this._exportVisibleGroupCount || 50;
        summary.groups.slice(0, visibleCount).forEach(group => {
            list.appendChild(this.createExportScoreGroup(group));
        });

        if (summary.groups.length > visibleCount) {
            const moreButton = document.createElement('button');
            moreButton.type = 'button';
            moreButton.className = 'export-show-more';
            const remaining = summary.groups.length - visibleCount;
            moreButton.textContent = `Show ${Math.min(50, remaining)} more score${remaining === 1 ? '' : 's'}`;
            moreButton.addEventListener('click', () => this.showMoreExportChanges());
            list.appendChild(moreButton);
        }

        if (preserveScroll) list.scrollTop = previousScrollTop;
    },

    createExportScoreGroup(group) {
        const scoreGroup = document.createElement('section');
        scoreGroup.className = 'export-score-group';

        const header = document.createElement('div');
        header.className = 'export-score-header';
        const title = document.createElement('div');
        title.className = 'export-score-title';
        title.textContent = group.title;
        const meta = document.createElement('div');
        meta.className = 'export-score-meta';
        meta.textContent = `${group.composer} · Row ${group.rowNum}`;
        header.append(title, meta);
        scoreGroup.appendChild(header);

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
        const headers = this.headers.filter(h => h !== '__id');
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
