export const modalUi = {
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

    showHelp() {
        document.getElementById('helpModal').classList.add('active');
    },

    closeHelp() {
        document.getElementById('helpModal').classList.remove('active');
    },

    closeExportModal() {
        document.getElementById('exportModal').classList.remove('active');
    },

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
