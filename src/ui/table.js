export const tableUi = {
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
};
