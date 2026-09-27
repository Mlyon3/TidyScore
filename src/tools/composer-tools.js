import {
    countComposers,
    proposeComposerExtractions,
    proposeComposerStandardization
} from '../domain/composers.js';
import { getRowId } from '../domain/row-identity.js';
import { proposeImslpCleanup } from '../domain/titles.js';

export const composerTools = {
    updateScanResults() {
        const counts = this.scanResults?.counts || {
            missingComposer: 0,
            composerFormatting: 0,
            imslpTitles: 0
        };
        const targets = {
            scanCountMissingComposer: counts.missingComposer,
            scanCountVariantComposer: counts.composerFormatting,
            scanCountImslpTitles: counts.imslpTitles,
            scanCountQuickClean: counts.quickClean || 0
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
        if (type === 'quickClean') {
            this.quickClean();
        }
    },

    async smartExtract() {
        if (!this.composerField || !this.titleField) {
            this.showNotification('Required fields not found');
            return;
        }

        const targetIndices = this.getTargetIds();
        const extractionResponse = this.requestComposerExtraction
            ? await this.requestComposerExtraction(targetIndices)
            : { ok: true, result: proposeComposerExtractions(this.getLibrary(), targetIndices, this.getComposerAliasMap()) };
        if (!extractionResponse.ok) {
            if (extractionResponse.code !== 'STALE_ANALYSIS') this.showNotification(extractionResponse.message);
            return;
        }
        const { titleExtractions, nameCompletions, checked, skipped } = extractionResponse.result;
        const extracted = [...titleExtractions, ...nameCompletions];

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

    toggleComposerStats(e) {
        e.stopPropagation();
        const dropdown = document.getElementById('composerStatsDropdown');
        if (!dropdown.classList.contains('hidden')) {
            dropdown.classList.add('hidden');
            return;
        }

        const sorted = countComposers(this.data, this.composerField, this.getComposerAliasMap());
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

        const fieldCounts = new Map(fields.map(field => [field.name, 0]));

        this.data.forEach(row => {
            const orig = this.originalDataById.get(getRowId(row));
            if (!orig) return;
            fields.forEach(f => {
                if (f.field && (row[f.field] || '') !== (orig[f.field] || '')) {
                    fieldCounts.set(f.name, fieldCounts.get(f.name) + 1);
                }
            });
        });

        let html = '';

        // Field breakdown section
        const hasFieldChanges = [...fieldCounts.values()].some(count => count > 0);
        if (hasFieldChanges) {
            html += `<div class="stat-dropdown-title">Changed Fields</div><div class="stat-dropdown-list">`;
            fieldCounts.forEach((count, name) => {
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

    cleanImslpTitles() {
        if (!this.titleField) {
            this.showNotification('Title field not found');
            return;
        }

        const cleanable = proposeImslpCleanup(this.getLibrary(), this.getTargetIds());
        if (cleanable.length === 0) {
            this.showNotification('No IMSLP titles found to clean.\n\nLooking for titles with:\n• IMSLP numbers\n• PMLP numbers\n• Excessive underscores');
            return;
        }

        this.pendingImslpCleanup = cleanable;
        this.showImslpModal();
    },

    standardizeComposers() {
        if (!this.composerField) {
            this.showNotification('Composer field not found in your CSV');
            return;
        }

        const changes = proposeComposerStandardization(this.getLibrary(), this.getTargetIds(), this.getComposerAliasMap());
        if (changes.length === 0) {
            const scopeLabel = this.getScopeLabel();
            const scope = scopeLabel ? ` (${scopeLabel})` : '';
            this.showNotification(`No composers to standardize${scope}`);
            return;
        }

        this._showPreview('Standardize Composers Preview', `Found <strong>${changes.length}</strong> composer value${changes.length !== 1 ? 's' : ''} to reformat using "First Last".`, changes, 'Composers standardized', 'Standardize');
    },
};
