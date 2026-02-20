export const csvCore = {
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

    detectField(possibleNames) {
        for (let name of possibleNames) {
            if (this.headers.includes(name)) {
                return name;
            }
        }
        return null;
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
};
