import { DUPLICATE_PAIR_BUDGET, DUPLICATE_REVIEW_TAG, detectDuplicates, setLabel } from '../domain/duplicates.js';
import { applyChanges } from '../domain/library.js';
import { addTag, proposeTagEdits } from '../domain/tags.js';

export const duplicateTools = {
    async openDuplicateModal() {
        this.closeGenreTagMenu();
        const duplicateResult = this.requestDuplicateAnalysis
            ? await this.requestDuplicateAnalysis(this.getTargetIds(), DUPLICATE_PAIR_BUDGET)
            : detectDuplicates(this.getLibrary(), this.getTargetIds(), { aliasMap: this.getComposerAliasMap() });
        if (!duplicateResult.ok) {
            if (duplicateResult.code === 'STALE_ANALYSIS') return;
            this.showNotification(duplicateResult.message);
            return;
        }
        const groups = duplicateResult.result;
        if (groups.length === 0) {
            this.showNotification('No potential duplicates found.');
            return;
        }

        this._dupGroups = groups;
        this._dupSelected = new Set();
        groups.filter(group => group.category === 'likely').forEach(group => {
            group.items.forEach(item => this._dupSelected.add(item.id));
        });

        this.renderDuplicateResults();
        this.activateModal(document.getElementById('duplicateModal'));
    },

    _allDuplicateIds() {
        return new Set(this._dupGroups.flatMap(group => group.items.map(item => item.id)));
    },

    _renderDuplicateEvidenceList(title, entries) {
        if (!entries.length) return '';
        const items = entries.map(entry => {
            const values = entry.values?.length ? ` <span class="dup-evidence-values">${entry.values.map(value => this.escapeHtml(value)).join(' · ')}</span>` : '';
            return `<li>${this.escapeHtml(entry.label)}${values}</li>`;
        }).join('');
        return `<div class="dup-evidence-section"><strong>${title}</strong><ul>${items}</ul></div>`;
    },

    _renderDuplicateItemMeta(item) {
        const details = [];
        if (item.displayFilename && item.displayFilename !== item.displayTitle) details.push(item.displayFilename);
        if (item.displayComposer) details.push(item.displayComposer);
        if (item.catalogues.size) details.push(`Catalogue: ${setLabel(item.catalogues)}`);
        if (item.workNumbers.size) details.push(`Number: ${setLabel(item.workNumbers)}`);
        if (item.keys.size) details.push(`Key: ${setLabel(item.keys)}`);
        if (item.instruments.size || item.roles.size) {
            details.push(`Type: ${[setLabel(item.instruments), setLabel(item.roles)].filter(Boolean).join(', ')}`);
        }
        return details.length ? details.map(detail => `<span>${this.escapeHtml(detail)}</span>`).join('') : '<span>No additional metadata</span>';
    },

    renderDuplicateResults() {
        const resultsDiv = document.getElementById('duplicateResults');
        const labels = {
            likely: 'Likely duplicate',
            possible: 'Possible duplicate',
            related: 'Related / likely separate'
        };
        let html = '';

        this._dupGroups.forEach((group, groupIndex) => {
            const selectedCount = group.items.filter(item => this._dupSelected.has(item.id)).length;
            const allSelected = selectedCount === group.items.length;
            const someSelected = selectedCount > 0 && !allSelected;
            const indeterminate = someSelected ? 'data-indeterminate="true"' : '';
            html += '<section class="dup-group">';
            html += '<div class="dup-group-header">';
            html += `<label><input class="dup-group-checkbox" data-group-index="${groupIndex}" ${indeterminate} type="checkbox" ${allSelected ? 'checked' : ''}> Group ${groupIndex + 1} (${group.items.length} items)</label>`;
            html += `<span class="dup-badge dup-badge-${group.category}">${labels[group.category]}</span>`;
            html += '</div>';
            html += `<p class="dup-summary">${this.escapeHtml(group.summary)}</p>`;
            html += '<details class="dup-evidence">';
            html += '<summary>Why these files were grouped</summary>';
            html += this._renderDuplicateEvidenceList('Matches', group.matches);
            html += this._renderDuplicateEvidenceList('Differences', group.conflicts);
            html += this._renderDuplicateEvidenceList('Missing information', group.missingEvidence);
            html += '</details>';

            group.items.forEach(item => {
                const checked = this._dupSelected.has(item.id) ? 'checked' : '';
                html += '<div class="dup-item">';
                html += `<input type="checkbox" ${checked} data-item-id="${item.id}" aria-label="Select ${this.escapeHtml(item.displayTitle)} for duplicate review tagging">`;
                html += '<div class="dup-item-info">';
                html += `<div class="dup-item-title">${this.escapeHtml(item.displayTitle)}</div>`;
                html += `<div class="dup-item-meta">${this._renderDuplicateItemMeta(item)}</div>`;
                html += '</div></div>';
            });
            html += '</section>';
        });

        resultsDiv.innerHTML = html;
        resultsDiv.querySelectorAll('.dup-group-checkbox').forEach(input => {
            input.addEventListener('change', () => this.toggleDupGroup(Number(input.dataset.groupIndex)));
        });
        resultsDiv.querySelectorAll('input[data-item-id]').forEach(input => {
            input.addEventListener('change', () => this.toggleDupItem(Number(input.dataset.itemId)));
        });
        resultsDiv.querySelectorAll('.dup-group-checkbox[data-indeterminate="true"]').forEach(input => {
            input.indeterminate = true;
        });

        const allIds = this._allDuplicateIds();
        const selectedVisibleCount = [...this._dupSelected].filter(id => allIds.has(id)).length;
        const selectAllCb = document.getElementById('dupSelectAll');
        selectAllCb.checked = allIds.size > 0 && selectedVisibleCount === allIds.size;
        selectAllCb.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < allIds.size;
        document.getElementById('dupSelectedCount').textContent = `${selectedVisibleCount} of ${allIds.size} unique files selected`;
    },

    toggleDupItem(id) {
        if (this._dupSelected.has(id)) this._dupSelected.delete(id);
        else this._dupSelected.add(id);
        this.renderDuplicateResults();
    },

    toggleDupGroup(groupIndex) {
        const group = this._dupGroups[groupIndex];
        const allSelected = group.items.every(item => this._dupSelected.has(item.id));
        group.items.forEach(item => {
            if (allSelected) this._dupSelected.delete(item.id);
            else this._dupSelected.add(item.id);
        });
        this.renderDuplicateResults();
    },

    toggleDupSelectAll() {
        const allIds = this._allDuplicateIds();
        const allSelected = [...allIds].every(id => this._dupSelected.has(id));
        allIds.forEach(id => {
            if (allSelected) this._dupSelected.delete(id);
            else this._dupSelected.add(id);
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

        const changes = proposeTagEdits(this.getLibrary(), [...this._dupSelected], value => addTag(value, DUPLICATE_REVIEW_TAG));
        if (changes.length) this.pushUndo('Tag Duplicates');
        const count = applyChanges(this.dataById, changes);
        this.modifiedCount += count;
        this.logChange('Duplicates tagged', count);
        this.closeDuplicateModal();
        this.renderTable();
        this.updateStats();
        this.showNotification(`Tagged ${count} file(s) with "${DUPLICATE_REVIEW_TAG}". Compare every tagged file in forScore before deleting anything.`);
    },

    closeDuplicateModal() {
        document.getElementById('duplicateModal').classList.remove('active');
    }
};
