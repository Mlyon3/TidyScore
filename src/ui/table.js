import { countModifiedFields } from '../core/data-model.js';
import { getRowId } from '../core/row-identity.js';

export const tableUi = {
    refreshModificationState() {
        this.modifiedCount = countModifiedFields(this.data, this.originalData, this.headers || []);
        return this.modifiedCount;
    },

    renderAll() {
        document.getElementById('importIntro')?.classList.add('hidden');
        document.getElementById('uploadSection').classList.add('hidden');
        document.getElementById('samplePrompt').classList.add('hidden');
        document.getElementById('privacyNote').classList.add('hidden');
        document.getElementById('statsSection').classList.remove('hidden');
        document.getElementById('tableSection').classList.remove('hidden');
        this.updateWorkflowSteps('review');
        this.updateRecoveryUi?.();

        this.updateStats();
        this.renderTable();
        this.scheduleSessionSave?.();
    },

    updateWorkflowSteps(activeStep = 'review') {
        const order = ['import', 'review', 'edit', 'return'];
        const activeIndex = order.indexOf(activeStep);
        order.forEach((step, index) => {
            const el = document.getElementById(`workflowStep${step[0].toUpperCase()}${step.slice(1)}`);
            if (!el) return;
            el.classList.toggle('active', index === activeIndex);
            el.classList.toggle('complete', index < activeIndex);
        });
    },

    updateStats() {
        this.refreshModificationState();
        const composers = new Set();
        this.data.forEach(row => {
            const value = this.composerField ? row[this.composerField] : '';
            this.normalizeComposerValue(value).entries.forEach(entry => composers.add(entry.formatted));
        });
        
        document.getElementById('totalScores').textContent = this.data.length;
        document.getElementById('uniqueComposers').textContent = composers.size;
        document.getElementById('modifiedCount').textContent = this.modifiedCount;
        const exportModifiedCount = document.getElementById('exportModifiedCount');
        if (exportModifiedCount) exportModifiedCount.textContent = this.modifiedCount;
        this.scanResults = this.computeScanResults();
        this.updateScanResults();
        this.scheduleSessionSave?.();
    },

    renderTable() {
        if (this._activeCellEdit) this.finishActiveCellEdit({ render: false });
        this.refreshModificationState();
        const modifiedCountEl = document.getElementById('modifiedCount');
        if (modifiedCountEl) modifiedCountEl.textContent = this.modifiedCount;

        const tbody = document.getElementById('tableBody');
        const thead = document.querySelector('thead');

        // Build entries using stable internal row identity.
        let entries;
        const query = this.currentFilter;
        if (query) {
            entries = [];
            const q = query.toLowerCase();
            this.data.forEach(row => {
                const searchStr = `${this.titleField ? row[this.titleField] : ''} ${this.composerField ? row[this.composerField] : ''} ${this.genreField ? row[this.genreField] : ''} ${this.tagsField ? row[this.tagsField] : ''}`.toLowerCase();
                if (searchStr.includes(q)) {
                    entries.push({row, _id: getRowId(row)});
                }
            });
        } else {
            entries = this.data.map(row => ({row, _id: getRowId(row)}));
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
        selectAll.setAttribute('aria-label', 'Select all visible scores');
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
            if (field) {
                th.tabIndex = 0;
                th.setAttribute('role', 'button');
                th.setAttribute('aria-label', `Sort by ${label}`);
                th.addEventListener('click', () => this.sortBy(field));
                th.addEventListener('keydown', event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        this.sortBy(field);
                    }
                });
            } else {
                th.classList.add('column-unavailable');
                th.setAttribute('aria-disabled', 'true');
                th.title = `${label} is not present in this CSV`;
            }
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

            const orig = this.originalDataById.get(_id);
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
            rowCheckbox.setAttribute('aria-label', `Select score ${_id + 1}`);
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
                if (!field) {
                    td.className = 'column-unavailable';
                    td.textContent = '—';
                    td.title = `${label} is not present in this CSV`;
                    return td;
                }
                td.setAttribute('data-editable', 'true');
                td.tabIndex = 0;
                if (modClass) td.className = modClass.trim();
                td.addEventListener('click', event => {
                    if (event.target.closest('input.editing')) return;
                    this.editCell(_id, field, td);
                });
                td.addEventListener('keydown', event => {
                    if (event.target.matches('input.editing')) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        this.editCell(_id, field, td);
                    }
                });

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

    finishActiveCellEdit({ cancel = false, render = true } = {}) {
        const active = this._activeCellEdit;
        if (!active || active.finished) return false;

        active.finished = true;
        active.suggestionsDropdown?.remove();
        this._activeCellEdit = null;

        let valueToDisplay = active.currentValue;
        let changed = false;
        if (!cancel) {
            valueToDisplay = active.field === this.composerField
                ? this.normalizeComposerValue(active.input.value).formatted
                : active.input.value;
            if (valueToDisplay !== active.currentValue) {
                this.pushUndo('Edit');
                active.row[active.field] = valueToDisplay;
                this.logChange('Manual edits', 1);
                this.analyzeData();
                this.updateStats();
                changed = true;
            }
        }

        if (!render && active.cell.isConnected) {
            const span = document.createElement('span');
            span.className = 'editable';
            span.textContent = valueToDisplay;
            active.cell.textContent = '';
            active.cell.appendChild(span);
            const original = this.originalDataById.get(active.id);
            active.cell.classList.toggle(
                'cell-modified',
                String(valueToDisplay ?? '') !== String(original?.[active.field] ?? '')
            );
        }
        if (render) this.renderTable();
        return changed;
    },

    editCell(id, field, cellElement) {
        this.finishActiveCellEdit({ render: false });
        this.editGeneration++;

        const cell = cellElement;
        const row = this.dataById.get(id);
        if (!row) return;
        const currentValue = row[field] || '';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'editing';
        input.value = currentValue;

        const active = {
            id,
            field,
            cell,
            row,
            input,
            currentValue,
            suggestionsDropdown: null,
            finished: false
        };
        this._activeCellEdit = active;

        const showSuggestions = () => {
            if (field !== this.composerField || active.finished) return;

            const normalized = this.normalizeComposerValue(input.value);
            const formattedSuggestion = normalized.entries.some(entry => entry.canonical !== entry.extracted)
                ? normalized.formatted
                : null;
            if (!formattedSuggestion || formattedSuggestion === input.value) {
                active.suggestionsDropdown?.remove();
                active.suggestionsDropdown = null;
                return;
            }

            if (!active.suggestionsDropdown) {
                const dropdown = document.createElement('div');
                dropdown.className = 'suggestions-dropdown';
                const rect = cell.getBoundingClientRect();
                dropdown.style.position = 'fixed';
                dropdown.style.left = rect.left + 'px';
                dropdown.style.top = (rect.bottom + 4) + 'px';
                dropdown.style.minWidth = rect.width + 'px';
                document.body.appendChild(dropdown);
                active.suggestionsDropdown = dropdown;
            }

            active.suggestionsDropdown.innerHTML = `
                <div class="suggestion-item">
                    <div class="suggestion-label">Suggested full name:</div>
                    <div class="suggestion-value">${this.escapeHtml(formattedSuggestion)}</div>
                </div>
            `;
            const suggestionItem = active.suggestionsDropdown.querySelector('.suggestion-item');
            suggestionItem.addEventListener('mousedown', event => event.preventDefault());
            suggestionItem.addEventListener('click', () => {
                input.value = formattedSuggestion;
                this.finishActiveCellEdit();
            });
        };

        input.addEventListener('input', showSuggestions);
        input.addEventListener('blur', () => {
            if (this._activeCellEdit === active) this.finishActiveCellEdit({ render: false });
        });

        input.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.finishActiveCellEdit({ cancel: true });
                return;
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                const rowIndex = this.visibleIds.indexOf(id);
                const fieldIndex = this.getFieldIndex(field);
                const navigationGeneration = this.editGeneration;
                this.finishActiveCellEdit();
                if (rowIndex !== -1 && rowIndex + 1 < this.visibleIds.length) {
                    setTimeout(() => {
                        if (this.editGeneration !== navigationGeneration) return;
                        const nextRow = document.getElementById('tableBody')?.children[rowIndex + 1];
                        nextRow?.querySelectorAll('td[data-editable="true"]')[fieldIndex]?.click();
                    }, 0);
                }
                return;
            }

            if (event.key === 'Tab') {
                event.preventDefault();
                event.stopPropagation();
                const fields = [this.titleField, this.composerField, this.genreField, this.tagsField].filter(Boolean);
                const currentFieldIndex = fields.indexOf(field);
                const nextFieldIndex = event.shiftKey
                    ? (currentFieldIndex > 0 ? currentFieldIndex - 1 : fields.length - 1)
                    : (currentFieldIndex < fields.length - 1 ? currentFieldIndex + 1 : 0);
                const rowIndex = this.visibleIds.indexOf(id);
                const navigationGeneration = this.editGeneration;
                this.finishActiveCellEdit();
                setTimeout(() => {
                    if (this.editGeneration !== navigationGeneration) return;
                    const visibleRow = document.getElementById('tableBody')?.children[rowIndex];
                    visibleRow?.querySelectorAll('td[data-editable="true"]')[nextFieldIndex]?.click();
                }, 0);
            }
        });

        cell.textContent = '';
        cell.appendChild(input);
        input.focus();
        input.select();
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
