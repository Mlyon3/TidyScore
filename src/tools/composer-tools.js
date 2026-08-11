import { getRowId } from '../core/row-identity.js';

const MULTI_COMPOSER_NON_NAME_WORDS = new Set([
    'and', 'arrangement', 'book', 'collection', 'concerto', 'concertos', 'duet', 'duets',
    'for', 'fugue', 'fugues', 'miniature', 'miniatures', 'music', 'nocturne', 'nocturnes',
    'or', 'piano', 'plus', 'prelude', 'preludes', 'quartet', 'quartets', 'score', 'selections',
    'sonata', 'sonatas', 'suite', 'suites', 'symphonies', 'symphony', 'the', 'trio', 'trios',
    'two', 'variation', 'variations', 'volume', 'with', 'work', 'works', 'bachs'
]);

export const composerTools = {
    getSuggestion(composer, aliasMap = null) {
        if (!composer) return null;
        const normalized = this._normalizeComposerAliasKey(composer);
        aliasMap = aliasMap || this.getComposerAliasMap();

        // 1. Exact normalized match (current behavior)
        if (Object.hasOwn(aliasMap, normalized)) return aliasMap[normalized];

        // 2. Strip diacritics from input and try direct lookup
        const strippedInput = this._stripDiacritics(normalized);
        if (strippedInput !== normalized && Object.hasOwn(aliasMap, strippedInput)) {
            return aliasMap[strippedInput];
        }

        // 3. Strip diacritics from map keys and compare
        for (const key in aliasMap) {
            if (!Object.hasOwn(aliasMap, key)) continue;
            if (this._stripDiacritics(key) === strippedInput) {
                return aliasMap[key];
            }
        }

        return null;
    },

    _isAmbiguousSingleWord(candidate) {
        const words = candidate.trim().split(/\s+/);
        return words.length === 1 && this._ambiguousAliases.has(candidate.toLowerCase().trim());
    },

    _tryGetSuggestion(candidate, aliasMap, allowAmbiguous = false) {
        if (!candidate || !candidate.trim()) return null;
        const trimmed = candidate.trim();
        if (!allowAmbiguous && this._isAmbiguousSingleWord(trimmed)) return null;
        const suggestion = this.getSuggestion(trimmed, aliasMap);
        return suggestion ? { extracted: trimmed, suggestion } : null;
    },

    _containsCpeCue(text = '') {
        if (!text || !text.trim()) return false;
        return /\bc\.?\s*p\.?\s*e\.?\b|carl\s+philipp\s+emanuel/iu.test(text);
    },

    _applyBachContextOverride(suggestion, contextText = '') {
        if (suggestion === 'Bach, Johann Sebastian' && this._containsCpeCue(contextText)) {
            return 'Bach, Carl Philipp Emanuel';
        }
        return suggestion;
    },

    _escapeComposerRegex(value = '') {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    },

    _findComposerMentions(title, aliasMap) {
        const searchableTitle = this._stripDiacritics(title.toLowerCase());
        const candidates = [];

        Object.entries(aliasMap).forEach(([alias, canonical]) => {
            const trimmedAlias = alias.trim();
            if (!trimmedAlias || this._isAmbiguousSingleWord(trimmedAlias)) return;

            const normalizedAlias = this._stripDiacritics(trimmedAlias.toLowerCase());
            const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${this._escapeComposerRegex(normalizedAlias)})(?=$|[^\\p{L}\\p{N}])`, 'gu');
            let match;
            while ((match = pattern.exec(searchableTitle)) !== null) {
                const start = match.index + match[1].length;
                const end = start + match[2].length;
                candidates.push({
                    start,
                    end,
                    extracted: title.slice(start, end),
                    canonical
                });
                if (match[0].length === 0) pattern.lastIndex++;
            }
        });

        const nonOverlapping = [];
        candidates
            .sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start)
            .forEach(candidate => {
                if (nonOverlapping.some(existing => candidate.start < existing.end && candidate.end > existing.start)) return;
                nonOverlapping.push(candidate);
            });

        nonOverlapping.sort((a, b) => a.start - b.start);
        const seen = new Set();
        return nonOverlapping.filter(match => {
            const key = this._stripDiacritics(match.canonical.toLowerCase());
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    },

    _extractMultipleComposersFromTitle(title, aliasMap) {
        const matches = this._findComposerMentions(title, aliasMap);
        if (matches.length < 2) return null;

        const masked = title.split('');
        matches.forEach(match => {
            for (let index = match.start; index < match.end; index++) {
                masked[index] = ' ';
            }
        });

        const unresolvedTokens = [...masked.join('').matchAll(/\p{Lu}[\p{L}\p{M}'’-]*/gu)]
            .map(match => match[0])
            .filter(token => !MULTI_COMPOSER_NON_NAME_WORDS.has(token.toLowerCase()));
        const entries = matches.map(match => ({
            extracted: match.extracted,
            canonical: match.canonical,
            formatted: this.formatComposerName(match.canonical)
        }));

        return {
            extracted: entries.map(entry => entry.extracted).join(', '),
            suggestion: entries[0].canonical,
            matches: entries,
            formattedSuggestion: entries.map(entry => entry.formatted).join(', '),
            isPartial: unresolvedTokens.length > 0,
            unresolvedTokens: [...new Set(unresolvedTokens)]
        };
    },

    _extractComposerFromTitle(title, aliasMap = null) {
        if (!title || !title.trim()) return null;
        title = title.trim();
        aliasMap = aliasMap || this.getComposerAliasMap();
        const multipleResult = this._extractMultipleComposersFromTitle(title, aliasMap);
        if (multipleResult) return multipleResult;

        const applyOverride = (result) => {
            if (!result) return null;
            const suggestion = this._applyBachContextOverride(result.suggestion, title);
            return {
                ...result,
                suggestion,
                matches: [{
                    extracted: result.extracted,
                    canonical: suggestion,
                    formatted: this.formatComposerName(suggestion)
                }],
                formattedSuggestion: this.formatComposerName(suggestion),
                isPartial: false,
                unresolvedTokens: []
            };
        };

        // Strategy 1: Separator-based segment scanning
        // Split on spaced dashes (preserving hyphenated names), underscore, colon, pipe, slash
        const separatorPattern = /\s+[-\u2013\u2014]\s+|[_:|\/]/;
        if (separatorPattern.test(title)) {
            const segments = title.split(separatorPattern).map(s => s.trim()).filter(Boolean);

            for (const segment of segments) {
                // Try full segment first (ambiguous words OK as full segments)
                const fullResult = this._tryGetSuggestion(segment, aliasMap, true);
                if (fullResult) return applyOverride(fullResult);

                // Try progressively shorter word prefixes within segment
                const words = segment.split(/\s+/);
                for (let len = Math.min(words.length - 1, 4); len >= 1; len--) {
                    const candidate = words.slice(0, len).join(' ');
                    const result = this._tryGetSuggestion(candidate, aliasMap, false);
                    if (result) return applyOverride(result);
                }

                // Try progressively shorter word suffixes within segment
                for (let len = Math.min(words.length - 1, 4); len >= 1; len--) {
                    const candidate = words.slice(-len).join(' ');
                    const result = this._tryGetSuggestion(candidate, aliasMap, false);
                    if (result) return applyOverride(result);
                }
            }
        }

        // Strategy 2: Parenthesized content
        const parenMatches = title.match(/\(([^)]+)\)/);
        if (parenMatches) {
            const inner = parenMatches[1].trim();
            // Ambiguous words OK in parentheses (explicit attribution)
            const fullResult = this._tryGetSuggestion(inner, aliasMap, true);
            if (fullResult) return applyOverride(fullResult);

            const words = inner.split(/\s+/);
            for (let len = Math.min(words.length - 1, 4); len >= 1; len--) {
                const candidate = words.slice(0, len).join(' ');
                const result = this._tryGetSuggestion(candidate, aliasMap, true);
                if (result) return applyOverride(result);
            }
        }

        // Strategy 3: "by" keyword
        const byMatch = title.match(/\bby\s+([\p{L}][\p{L}.\s-]*?)(?:\s*[,)\u2013\u2014|]|\s*$)/iu);
        if (byMatch) {
            const candidate = byMatch[1].trim();
            // Ambiguous words OK after "by" (explicit attribution)
            const fullResult = this._tryGetSuggestion(candidate, aliasMap, true);
            if (fullResult) return applyOverride(fullResult);

            const words = candidate.split(/\s+/);
            for (let len = Math.min(words.length - 1, 4); len >= 1; len--) {
                const cand = words.slice(0, len).join(' ');
                const result = this._tryGetSuggestion(cand, aliasMap, true);
                if (result) return applyOverride(result);
            }
        }

        // Strategy 4: Structural patterns (Unicode-aware, start-anchored)
        const structuralPatterns = [
            // "Bach - Prelude" or "J.S. Bach - Air" (with Unicode letter support)
            /^([\p{Lu}][\p{Ll}]+(?:\s+[\p{Lu}]\.?\s*[\p{Lu}]\.?\s*)?(?:\s+[\p{Lu}][\p{Ll}]+)?)\s*[-\u2013\u2014]\s*/u,
            // "Dvorak_SQ12"
            /^([\p{Lu}][\p{Ll}]+)_/u,
            // "Bach Suite" or "Beethoven Sonata" (expanded form keywords)
            /^([\p{Lu}][\p{Ll}]+)\s+(?:[Ss]uite|[Ss]onata|[Ss]ymphony|[Cc]oncerto|[Qq]uartet|[Qq]uintet|[Pp]relude|[Ff]ugue|[Cc]antata|[Mm]ass|[Rr]equiem|[Oo]verture|[Rr]hapsody|[Nn]octurne|[EÉeé]tude|[Ww]altz|[Pp]olonaise|[Mm]azurka|[Bb]allade|[Ii]mpromptu|[Vv]ariations|[Ss]erenade|[Dd]ivertimento|[Tt]rio|[Oo]pus|Op\.|No\.)/u,
            // "Bach 3rd" or "Beethoven 5th"
            /^([\p{Lu}][\p{Ll}]+)\s+\d/u
        ];

        for (const pattern of structuralPatterns) {
            const match = title.match(pattern);
            if (match) {
                const potentialComposer = match[1].trim();
                const suggestion = this.getSuggestion(potentialComposer, aliasMap);
                if (suggestion) {
                    return applyOverride({ extracted: potentialComposer, suggestion });
                }
            }
        }

        // Strategy 5: Multi-word prefix scan (for titles without separators)
        const titleWords = title.split(/\s+/);
        for (let len = Math.min(titleWords.length - 1, 5); len >= 2; len--) {
            const candidate = titleWords.slice(0, len).join(' ');
            const result = this._tryGetSuggestion(candidate, aliasMap, false);
            if (result) return applyOverride(result);
        }

        // Strategy 6: First-word fallback (ambiguous words blocked)
        const firstWord = title.split(/[\s\-\u2013\u2014_]/)[0].trim();
        if (firstWord.length > 2) {
            const result = this._tryGetSuggestion(firstWord, aliasMap, false);
            if (result) return applyOverride(result);
        }

        return null;
    },

    getComposerExtractionSignals(targetIds = []) {
        const signals = {
            titleExtractions: [],
            nameCompletions: [],
            checked: 0,
            skipped: 0
        };

        if (!this.composerField || !this.titleField) {
            return signals;
        }

        const aliasMap = this.getComposerAliasMap();

        targetIds.forEach(id => {
            const row = this.dataById.get(id);
            if (!row) return;

            const title = row[this.titleField] || '';
            const currentComposer = row[this.composerField] || '';

            if (currentComposer) {
                signals.skipped++;
            } else {
                signals.checked++;

                const result = this._extractComposerFromTitle(title, aliasMap);
                if (result) {
                    signals.titleExtractions.push({
                        id,
                        title,
                        ...result,
                        type: 'title'
                    });
                }
            }

            if (currentComposer) {
                const normalized = this.normalizeComposerValue(currentComposer, aliasMap);
                if (normalized.formatted && normalized.formatted !== currentComposer.trim()) {
                    signals.nameCompletions.push({
                        id,
                        title,
                        extracted: currentComposer.trim(),
                        suggestion: normalized.entries[0]?.canonical || currentComposer.trim(),
                        matches: normalized.entries,
                        formattedSuggestion: normalized.formatted,
                        isPartial: false,
                        unresolvedTokens: [],
                        type: 'completion'
                    });
                }
            }
        });

        return signals;
    },

    getStandardizeComposerCandidateIds(targetIds = []) {
        if (!this.composerField) {
            return [];
        }

        const candidates = [];
        const aliasMap = this.getComposerAliasMap();

        targetIds.forEach(id => {
            const row = this.dataById.get(id);
            if (!row) return;

            const composer = row[this.composerField];
            if (!composer) return;

            const normalized = composer.trim();
            if (!normalized) return;

            const newVal = this.normalizeComposerValue(normalized, aliasMap).formatted;
            if (!newVal || newVal === normalized) return;

            candidates.push(id);
        });

        return candidates;
    },

    computeScanResults(targetIds = null) {
        const ids = Array.isArray(targetIds)
            ? targetIds
            : this.data.map(row => getRowId(row));

        const candidates = {
            missingComposer: [],
            composerFormatting: [],
            imslpTitles: [],
            quickClean: []
        };

        const extractionSignals = this.getComposerExtractionSignals(ids);
        const extractionCandidateIds = new Set([
            ...extractionSignals.titleExtractions.map(item => item.id),
            ...extractionSignals.nameCompletions.map(item => item.id)
        ]);
        candidates.missingComposer = [...extractionCandidateIds];

        candidates.composerFormatting = this.getStandardizeComposerCandidateIds(ids);

        ids.forEach(id => {
            const row = this.dataById.get(id);
            if (!row) return;

            const title = this.titleField ? (row[this.titleField] || '') : '';

            if (this.titleField && this.needsImslpCleanup(title) && this.cleanImslpTitle(title) !== title) {
                candidates.imslpTitles.push(id);
            }

        });

        candidates.quickClean = this.getQuickCleanChanges(ids);

        return {
            counts: {
                missingComposer: candidates.missingComposer.length,
                composerFormatting: candidates.composerFormatting.length,
                imslpTitles: candidates.imslpTitles.length,
                quickClean: candidates.quickClean.length
            },
            candidates,
            extractionSignals: {
                checked: extractionSignals.checked,
                skipped: extractionSignals.skipped,
                titleCount: extractionSignals.titleExtractions.length,
                completionCount: extractionSignals.nameCompletions.length
            }
        };
    },

    detectComposerFromTitle(title = '') {
        return this._extractComposerFromTitle(title) !== null;
    },

    needsComposerStandardization(composer = '') {
        const normalized = composer.trim();
        if (!normalized) return false;

        const standardized = this.normalizeComposerValue(normalized).formatted;
        return Boolean(standardized && standardized !== normalized);
    },

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
        console.log('Smart Extract started');

        if (!this.composerField || !this.titleField) {
            this.showNotification('Required fields not found');
            return;
        }

        const targetIndices = this.getTargetIds();
        console.log('Processing', targetIndices.length, 'entries');

        const extractionResponse = this.requestComposerExtraction
            ? await this.requestComposerExtraction(targetIndices)
            : { ok: true, result: this.getComposerExtractionSignals(targetIndices) };
        if (!extractionResponse.ok) {
            if (extractionResponse.code !== 'STALE_ANALYSIS') this.showNotification(extractionResponse.message);
            return;
        }
        const signals = extractionResponse.result;
        const titleExtractions = signals.titleExtractions;
        const nameCompletions = signals.nameCompletions;
        const checked = signals.checked;
        const skipped = signals.skipped;
        const extracted = [...titleExtractions, ...nameCompletions];

        console.log('Results:', {
            scanned: targetIndices.length,
            checked: checked,
            skipped: skipped,
            titleExtractions: titleExtractions.length,
            nameCompletions: nameCompletions.length
        });

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

        const counts = new Map();
        const aliasMap = this.getComposerAliasMap();
        this.data.forEach(row => {
            const composer = this.composerField ? (row[this.composerField] || '').trim() : '';
            if (composer) {
                this.normalizeComposerValue(composer, aliasMap).entries.forEach(entry => {
                    counts.set(entry.formatted, (counts.get(entry.formatted) || 0) + 1);
                });
            }
        });

        const sorted = [...counts].sort((a, b) => b[1] - a[1]);
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
        console.log('IMSLP Cleanup started');
        
        if (!this.titleField) {
            this.showNotification('Title field not found');
            return;
        }

        let cleanable = [];
        const targetIndices = this.getTargetIds();

        targetIndices.forEach(idx => {
            const row = this.dataById.get(idx);
            const title = row[this.titleField] || '';

            // Check if this looks like an IMSLP title
            if (this.needsImslpCleanup(title)) {
                const cleaned = this.cleanImslpTitle(title);
                if (cleaned !== title) {
                    cleanable.push({
                        id: idx,
                        original: title,
                        cleaned
                    });
                }
            }
        });

        console.log('IMSLP cleanup results:', {
            scanned: targetIndices.length,
            cleanable: cleanable.length
        });

        if (cleanable.length === 0) {
            this.showNotification('No IMSLP titles found to clean.\n\nLooking for titles with:\n• IMSLP numbers\n• PMLP numbers\n• Excessive underscores');
            return;
        }

        // Store cleanup results and show modal
        this.pendingImslpCleanup = cleanable;
        this.showImslpModal();
    },

    needsImslpCleanup(title) {
        // Check if title has IMSLP patterns that need cleaning
        return /IMSLP\d+/.test(title) || 
               /PMLP\d+/.test(title) || 
               /_[A-Z]/.test(title) ||  // Has underscore before capital letter
               /^_/.test(title) ||      // Starts with underscore
               title.split('_').length > 3;  // Has multiple underscores
    },

    cleanImslpTitle(title, addLabel = true) {
        let cleaned = title;
        
        // Remove IMSLP and PMLP prefixes with numbers
        cleaned = cleaned.replace(/^IMSLP\d+-?/g, '');
        cleaned = cleaned.replace(/^PMLP\d+-?/g, '');
        cleaned = cleaned.replace(/-PMLP\d+-?/g, '-');
        
        // Convert underscores to spaces
        cleaned = cleaned.replace(/_/g, ' ');
        
        // Remove leading/trailing dashes and spaces
        cleaned = cleaned.replace(/^[-\s]+|[-\s]+$/g, '');
        
        // Clean up multiple spaces
        cleaned = cleaned.replace(/\s+/g, ' ');
        
        // Remove .pdf extension if present
        cleaned = cleaned.replace(/\.pdf$/i, '');
        
        // Add (IMSLP) suffix if option enabled and it looked like an IMSLP file
        if (addLabel && title.match(/IMSLP\d+|PMLP\d+/) && !cleaned.includes('(IMSLP)')) {
            cleaned = cleaned + ' (IMSLP)';
        }
        
        return cleaned.trim();
    },

    standardizeComposers() {
        if (!this.composerField) {
            this.showNotification('Composer field not found in your CSV');
            return;
        }

        const targetIndices = this.getTargetIds();
        const changes = [];
        const aliasMap = this.getComposerAliasMap();
        targetIndices.forEach(idx => {
            const row = this.dataById.get(idx);
            const composer = row[this.composerField];
            if (!composer) return;

            const normalized = composer.trim();
            if (!normalized) return;

            const newVal = this.normalizeComposerValue(normalized, aliasMap).formatted;
            if (!newVal || newVal === normalized) return;

            changes.push({
                id: idx,
                label: `Row ${idx + 1}`,
                detail: composer,
                newDetail: newVal,
                field: this.composerField,
                newVal
            });
        });

        if (changes.length === 0) {
            const scopeLabel = this.getScopeLabel();
            const scope = scopeLabel ? ` (${scopeLabel})` : '';
            this.showNotification(`No composers to standardize${scope}`);
            return;
        }

        this._showPreview('Standardize Composers Preview', `Found <strong>${changes.length}</strong> composer value${changes.length !== 1 ? 's' : ''} to reformat using "First Last".`, changes, 'Composers standardized', 'Standardize');
    },
};
