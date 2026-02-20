// ===== Duplicate Detection =====
// Extracted from index.html to keep duplicate-detection logic modular.
export const duplicateTools = {
    parseTitleForDedup(title) {
        let coreName = title.toLowerCase();
        const modifiers = { instruments: new Set(), numbers: new Set(), keys: new Set() };

        const instrumentRe = /\b(score|part|parts|cello|vc|violin|vln|viola|vla|piano|pno|flute|fl|clarinet|cl|oboe|ob|trumpet|tpt|trombone|tbn|bass|horn|harp|guitar|gtr|percussion|perc|timpani|timp|solo|duet|trio|quartet|quintet|soprano|alto|tenor|baritone|sax|saxophone|bassoon|bsn|piccolo|organ)\b/gi;
        const numberRe = /\b(book\s*)?([1-4]|i{1,3}|iv|1st|2nd|3rd|4th)\b/gi;
        const keyRe = /\b([A-G][b#]?\s*(?:major|minor|maj|min|dur|moll)?)\b/gi;
        const versionRe = /\(\d+\)|copy|v\d+/gi;
        const extensionRe = /\.pdf$/i;

        // Strip extension and version artifacts
        coreName = coreName.replace(extensionRe, '');
        coreName = coreName.replace(versionRe, '');

        // Extract instruments
        let match;
        while ((match = instrumentRe.exec(coreName)) !== null) {
            modifiers.instruments.add(match[0].toLowerCase());
        }
        coreName = coreName.replace(instrumentRe, '');

        // Extract numbers/ordinals
        while ((match = numberRe.exec(coreName)) !== null) {
            modifiers.numbers.add(match[0].toLowerCase().replace(/\s+/g, ''));
        }
        coreName = coreName.replace(numberRe, '');

        // Extract keys
        while ((match = keyRe.exec(coreName)) !== null) {
            modifiers.keys.add(match[0].toLowerCase().trim());
        }
        coreName = coreName.replace(keyRe, '');

        // Build grouping key: lowercase alphanumeric only
        const groupKey = coreName.replace(/[^a-z0-9]/g, '');

        return { groupKey, modifiers, original: title };
    },

    detectDuplicates() {
        const groups = new Map();

        this.data.forEach(row => {
            const title = (this.titleField ? row[this.titleField] : '') ||
                (this.filenameField ? row[this.filenameField] : '') || '';
            if (!title) return;

            const parsed = this.parseTitleForDedup(title);
            if (parsed.groupKey.length < 5) return;

            if (!groups.has(parsed.groupKey)) {
                groups.set(parsed.groupKey, []);
            }
            groups.get(parsed.groupKey).push({
                id: row.__id,
                title,
                composer: this.composerField ? (row[this.composerField] || '') : '',
                modifiers: parsed.modifiers
            });
        });

        const result = [];

        groups.forEach((items, key) => {
            if (items.length < 2) return;

            let hasClash = false;
            for (let i = 0; i < items.length && !hasClash; i++) {
                for (let j = i + 1; j < items.length && !hasClash; j++) {
                    const modsA = items[i].modifiers;
                    const modsB = items[j].modifiers;

                    // Instrument clash: A has instruments B doesn't (and B has instruments too)
                    const instClash = modsA.instruments.size > 0 && modsB.instruments.size > 0 &&
                        [...modsA.instruments].some(inst => !modsB.instruments.has(inst));

                    // Number clash: A has numbers B doesn't (and B has numbers too)
                    const numClash = modsA.numbers.size > 0 && modsB.numbers.size > 0 &&
                        [...modsA.numbers].some(num => !modsB.numbers.has(num));

                    if (instClash || numClash) hasClash = true;
                }
            }

            result.push({
                key,
                items,
                confidence: hasClash ? 'low' : 'high'
            });
        });

        // Sort high-confidence groups first
        result.sort((a, b) => {
            if (a.confidence === b.confidence) return 0;
            return a.confidence === 'high' ? -1 : 1;
        });

        return result;
    },

    openDuplicateModal() {
        this.closeGenreTagMenu();

        const groups = this.detectDuplicates();
        if (groups.length === 0) {
            this.showNotification('No potential duplicates found.');
            return;
        }

        this._dupGroups = groups;
        this._dupSelected = new Set();

        // Pre-select all items in high-confidence groups only
        groups.forEach(group => {
            if (group.confidence === 'high') {
                group.items.forEach(item => this._dupSelected.add(item.id));
            }
        });

        this.renderDuplicateResults();
        document.getElementById('duplicateModal').classList.add('active');
    },

    renderDuplicateResults() {
        const resultsDiv = document.getElementById('duplicateResults');
        let html = '';
        let totalItems = 0;

        this._dupGroups.forEach((group, groupIndex) => {
            const isHigh = group.confidence === 'high';
            const badgeClass = isHigh ? 'dup-badge-high' : 'dup-badge-low';
            const badgeText = isHigh ? 'Likely duplicate' : 'Likely separate parts';
            const allSelected = group.items.every(item => this._dupSelected.has(item.id));

            html += `<div class="dup-group">`;
            html += '<div class="dup-group-header">';
            html += `<label><input type="checkbox" ${allSelected ? 'checked' : ''} onchange="app.toggleDupGroup(${groupIndex})"> Group ${groupIndex + 1} (${group.items.length} items)</label>`;
            html += `<span class="dup-badge ${badgeClass}">${badgeText}</span>`;
            html += '</div>';

            group.items.forEach(item => {
                const checked = this._dupSelected.has(item.id) ? 'checked' : '';
                html += '<div class="dup-item">';
                html += `<input type="checkbox" ${checked} onchange="app.toggleDupItem(${item.id})">`;
                html += '<div class="dup-item-info">';
                html += `<div class="dup-item-title">${this.escapeHtml(item.title)}</div>`;
                html += `<div class="dup-item-composer">${this.escapeHtml(item.composer || 'No Composer')}</div>`;
                html += '</div></div>';
                totalItems++;
            });

            html += '</div>';
        });

        resultsDiv.innerHTML = html;

        // Update select-all checkbox state
        const selectAllCb = document.getElementById('dupSelectAll');
        selectAllCb.checked = totalItems > 0 && this._dupSelected.size === totalItems;
        selectAllCb.indeterminate = this._dupSelected.size > 0 && this._dupSelected.size < totalItems;

        // Update count display
        document.getElementById('dupSelectedCount').textContent = `${this._dupSelected.size} of ${totalItems} selected`;
    },

    toggleDupItem(id) {
        if (this._dupSelected.has(id)) {
            this._dupSelected.delete(id);
        } else {
            this._dupSelected.add(id);
        }
        this.renderDuplicateResults();
    },

    toggleDupGroup(groupIndex) {
        const group = this._dupGroups[groupIndex];
        const allSelected = group.items.every(item => this._dupSelected.has(item.id));

        group.items.forEach(item => {
            if (allSelected) {
                this._dupSelected.delete(item.id);
            } else {
                this._dupSelected.add(item.id);
            }
        });
        this.renderDuplicateResults();
    },

    toggleDupSelectAll() {
        let totalItems = 0;
        this._dupGroups.forEach(g => totalItems += g.items.length);

        const allSelected = this._dupSelected.size === totalItems;

        this._dupGroups.forEach(group => {
            group.items.forEach(item => {
                if (allSelected) {
                    this._dupSelected.delete(item.id);
                } else {
                    this._dupSelected.add(item.id);
                }
            });
        });
        this.renderDuplicateResults();
    },

    applyDuplicateTags() {
        if (this._dupSelected.size === 0) {
            this.showNotification('No items selected to tag.');
            return;
        }

        if (!this.tagsField) {
            this.showNotification('Tags field is required for duplicate tagging.');
            return;
        }

        this.pushUndo('Tag Duplicates');
        let count = 0;

        this._dupSelected.forEach(id => {
            const row = this.dataById.get(id);
            if (!row) return;

            const existingTags = (row[this.tagsField] || '')
                .split(';')
                .map(t => t.trim())
                .filter(Boolean);

            if (!existingTags.includes('_Duplicate_Delete_Me')) {
                existingTags.push('_Duplicate_Delete_Me');
                row[this.tagsField] = existingTags.join('; ');
                count++;
            }
        });

        this.modifiedCount += count;
        this.logChange('Duplicates tagged', count);
        this.closeDuplicateModal();
        this.renderTable();
        this.updateStats();
        this.showNotification('Tagged ' + count + ' file(s) with "_Duplicate_Delete_Me". Filter by this tag in forScore to delete them.');
    },

    closeDuplicateModal() {
        document.getElementById('duplicateModal').classList.remove('active');
    }
};
