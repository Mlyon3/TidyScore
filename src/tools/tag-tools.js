export const tagTools = {
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
};
