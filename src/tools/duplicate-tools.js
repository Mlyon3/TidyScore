// ===== Evidence-based Duplicate Detection =====

const CATEGORY_ORDER = { likely: 0, possible: 1, related: 2 };

const INSTRUMENT_ALIASES = {
    cello: ['cello', 'vc'],
    violin: ['violin', 'vln', 'vn'],
    viola: ['viola', 'vla'],
    piano: ['piano', 'pno'],
    flute: ['flute', 'fl'],
    clarinet: ['clarinet', 'cl'],
    oboe: ['oboe', 'ob'],
    trumpet: ['trumpet', 'tpt'],
    trombone: ['trombone', 'tbn'],
    bass: ['bass'],
    horn: ['horn'],
    harp: ['harp'],
    guitar: ['guitar', 'gtr'],
    percussion: ['percussion', 'perc'],
    timpani: ['timpani', 'timp'],
    soprano: ['soprano'],
    alto: ['alto'],
    tenor: ['tenor'],
    baritone: ['baritone'],
    saxophone: ['saxophone', 'sax'],
    bassoon: ['bassoon', 'bsn'],
    piccolo: ['piccolo'],
    organ: ['organ']
};

const ROLE_ALIASES = {
    score: ['full score', 'score'],
    part: ['parts', 'part'],
    reduction: ['reduction', 'piano reduction'],
    arrangement: ['arrangement', 'arranged', 'arr'],
    solo: ['solo'],
    duet: ['duet', 'duo'],
    trio: ['trio'],
    quartet: ['quartet'],
    quintet: ['quintet']
};

function stripDiacritics(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function wordsOnly(value) {
    return stripDiacritics(value.toLowerCase())
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function compact(value) {
    return wordsOnly(value).replace(/\s/g, '');
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractAliases(text, aliases) {
    const found = new Set();
    let remainder = text;
    const entries = Object.entries(aliases)
        .flatMap(([canonical, values]) => values.map(value => ({ canonical, value })))
        .sort((a, b) => b.value.length - a.value.length);

    entries.forEach(({ canonical, value }) => {
        const pattern = new RegExp(`\\b${escapeRegex(value).replace(/\\ /g, '\\s+')}\\b`, 'gi');
        if (pattern.test(remainder)) {
            found.add(canonical);
            remainder = remainder.replace(pattern, ' ');
        }
    });

    return { found, remainder };
}

function normalizedSet(set) {
    return [...set].sort();
}

function sameSet(a, b) {
    if (a.size !== b.size) return false;
    return [...a].every(value => b.has(value));
}

function setLabel(set) {
    return normalizedSet(set).join(', ');
}

function uniqueEvidence(entries) {
    const seen = new Set();
    return entries.filter(entry => {
        const key = `${entry.label}|${entry.values?.join('|') || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function evidence(label, points, values = []) {
    return { label, points, values };
}

function normalizeComposer(value, context) {
    const raw = (value || '').toString().trim();
    if (!raw) return '';

    if (typeof context.normalizeComposerValue === 'function') {
        return context.normalizeComposerValue(raw).entries
            .map(entry => wordsOnly(entry.canonical).split(' ').filter(Boolean).sort().join(' '))
            .sort()
            .join('|');
    }

    let canonical = raw;
    if (typeof context.getSuggestion === 'function') {
        canonical = context.getSuggestion(raw) || raw;
    }

    return wordsOnly(canonical).split(' ').filter(Boolean).sort().join(' ');
}

function mergeSets(...sets) {
    return new Set(sets.flatMap(set => [...set]));
}

function hasCoreMatch(a, b) {
    const aCores = [a.title.core, a.filename.core].filter(core => core.length >= 5);
    const bCores = [b.title.core, b.filename.core].filter(core => core.length >= 5);
    return aCores.some(core => bCores.includes(core));
}

function compareSetEvidence(matches, conflicts, missing, label, a, b, points, penalty) {
    if (a.size && b.size) {
        if (sameSet(a, b)) {
            matches.push(evidence(`${label} agrees`, points, [setLabel(a)]));
            return points;
        }
        conflicts.push(evidence(`${label} differs`, penalty, [setLabel(a), setLabel(b)]));
        return penalty;
    }
    if (a.size || b.size) {
        missing.push(evidence(`${label} is unavailable for one item`, 0, [setLabel(a) || 'Not provided', setLabel(b) || 'Not provided']));
    }
    return 0;
}

function pairKey(a, b) {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function buildCompleteLinkGroups(pairs, category, pairLookup) {
    const eligible = pairs
        .filter(pair => pair.category === category)
        .sort((a, b) => b.score - a.score || a.a.id - b.a.id || a.b.id - b.b.id);
    const ids = [...new Set(eligible.flatMap(pair => [pair.a.id, pair.b.id]))].sort((a, b) => a - b);
    let clusters = ids.map(id => [id]);

    eligible.forEach(pair => {
        const leftIndex = clusters.findIndex(cluster => cluster.includes(pair.a.id));
        const rightIndex = clusters.findIndex(cluster => cluster.includes(pair.b.id));
        if (leftIndex === rightIndex) return;

        const left = clusters[leftIndex];
        const right = clusters[rightIndex];
        const compatible = left.every(leftId => right.every(rightId =>
            pairLookup.get(pairKey(leftId, rightId))?.category === category
        ));
        if (!compatible) return;

        const merged = [...left, ...right].sort((a, b) => a - b);
        clusters = clusters.filter((_, index) => index !== leftIndex && index !== rightIndex);
        clusters.push(merged);
    });

    return clusters.filter(cluster => cluster.length > 1);
}

function buildRelatedFamilies(pairs) {
    const related = pairs.filter(pair => pair.category === 'related');
    const adjacency = new Map();
    related.forEach(pair => {
        if (!adjacency.has(pair.a.id)) adjacency.set(pair.a.id, new Set());
        if (!adjacency.has(pair.b.id)) adjacency.set(pair.b.id, new Set());
        adjacency.get(pair.a.id).add(pair.b.id);
        adjacency.get(pair.b.id).add(pair.a.id);
    });

    const visited = new Set();
    const families = [];
    [...adjacency.keys()].sort((a, b) => a - b).forEach(start => {
        if (visited.has(start)) return;
        const pending = [start];
        const family = [];
        visited.add(start);
        while (pending.length) {
            const id = pending.shift();
            family.push(id);
            [...(adjacency.get(id) || [])].sort((a, b) => a - b).forEach(next => {
                if (!visited.has(next)) {
                    visited.add(next);
                    pending.push(next);
                }
            });
        }
        if (family.length > 1) families.push(family.sort((a, b) => a - b));
    });
    return families;
}

function summarizeGroup(category, matches, conflicts) {
    const labels = (category === 'related' ? conflicts : matches).slice(0, 3).map(item => item.label.toLowerCase());
    if (category === 'likely') return labels.length ? `Strong match: ${labels.join('; ')}.` : 'Strong metadata match.';
    if (category === 'possible') return labels.length ? `Possible match: ${labels.join('; ')}.` : 'Some metadata matches, but evidence is incomplete.';
    return labels.length ? `Likely separate: ${labels.join('; ')}.` : 'The files appear related but contain meaningful differences.';
}

export const duplicateTools = {
    parseTitleForDedup(value) {
        const original = (value || '').toString().trim();
        let text = stripDiacritics(original.toLowerCase()).replace(/\.pdf\s*$/i, '').trim();
        const copyMarkers = new Set();

        const copyPatterns = [
            { label: 'numbered copy', regex: /\(\s*\d+\s*\)\s*$/gi },
            { label: 'copy', regex: /\bcopy\b/gi },
            { label: 'duplicate', regex: /\bduplicate\b/gi },
            { label: 'version', regex: /\bv\s*\d+\b/gi }
        ];
        copyPatterns.forEach(({ label, regex }) => {
            if (regex.test(text)) copyMarkers.add(label);
            text = text.replace(regex, ' ');
        });

        const normalized = compact(text);
        let remainder = text;

        const instrumentsResult = extractAliases(remainder, INSTRUMENT_ALIASES);
        const instruments = instrumentsResult.found;
        remainder = instrumentsResult.remainder;

        const rolesResult = extractAliases(remainder, ROLE_ALIASES);
        const roles = rolesResult.found;
        remainder = rolesResult.remainder;

        const keys = new Set();
        const keyRe = /\b([a-g])\s*(flat|sharp|b|#)?\s+(major|minor|maj|min|dur|moll)\b/gi;
        remainder = remainder.replace(keyRe, (_, note, accidental = '', mode) => {
            const accidentalMap = { flat: 'b', sharp: '#', b: 'b', '#': '#' };
            const modeMap = { maj: 'major', dur: 'major', min: 'minor', moll: 'minor' };
            keys.add(`${note.toUpperCase()}${accidentalMap[accidental.toLowerCase()] || ''} ${modeMap[mode.toLowerCase()] || mode.toLowerCase()}`);
            return ' ';
        });

        const catalogues = new Set();
        const catalogueRe = /\b(bwv|k(?:v)?|rv|hwv|hob|woo|sz|op(?:us)?)\.?\s*([a-z]*\s*\d+[a-z0-9.:/-]*)\b/gi;
        remainder = remainder.replace(catalogueRe, (_, prefix, identifier) => {
            const normalizedPrefix = prefix.toLowerCase() === 'opus' ? 'op' : prefix.toLowerCase();
            catalogues.add(`${normalizedPrefix} ${wordsOnly(identifier).replace(/\s/g, '')}`);
            return ' ';
        });

        const workNumbers = new Set();
        const workNumberRe = /\b(no|nr|book|vol|volume|movement|mvmt)\.?\s*([0-9]+|[ivxlcdm]+)(?:st|nd|rd|th)?\b/gi;
        remainder = remainder.replace(workNumberRe, (_, label, number) => {
            const labelMap = { nr: 'no', volume: 'vol', mvmt: 'movement' };
            workNumbers.add(`${labelMap[label.toLowerCase()] || label.toLowerCase()} ${number.toLowerCase()}`);
            return ' ';
        });

        const core = compact(remainder);
        return {
            original,
            normalized,
            core,
            groupKey: core,
            copyMarkers,
            instruments,
            roles,
            keys,
            catalogues,
            workNumbers,
            modifiers: { instruments, numbers: workNumbers, keys }
        };
    },

    _buildDuplicateIdentity(row) {
        const title = this.parseTitleForDedup(this.titleField ? row[this.titleField] : '');
        const filename = this.parseTitleForDedup(this.filenameField ? row[this.filenameField] : '');
        return {
            id: row.__id,
            row,
            displayTitle: (this.titleField ? row[this.titleField] : '') ||
                (this.filenameField ? row[this.filenameField] : '') || '',
            displayFilename: this.filenameField ? (row[this.filenameField] || '') : '',
            displayComposer: this.composerField ? (row[this.composerField] || '') : '',
            composer: normalizeComposer(this.composerField ? row[this.composerField] : '', this),
            title,
            filename,
            copyMarkers: mergeSets(title.copyMarkers, filename.copyMarkers),
            instruments: mergeSets(title.instruments, filename.instruments),
            roles: mergeSets(title.roles, filename.roles),
            keys: mergeSets(title.keys, filename.keys),
            catalogues: mergeSets(title.catalogues, filename.catalogues),
            workNumbers: mergeSets(title.workNumbers, filename.workNumbers),
            sources: new Set([
                ...(title.original ? ['title'] : []),
                ...(filename.original ? ['filename'] : [])
            ])
        };
    },

    _compareDuplicatePair(a, b) {
        if (!hasCoreMatch(a, b)) return null;

        const matches = [];
        const conflicts = [];
        const missingEvidence = [];
        let score = 0;
        let directMatch = false;

        if (a.filename.normalized && a.filename.normalized === b.filename.normalized) {
            matches.push(evidence('Filename matches after copy-marker removal', 55));
            score += 55;
            directMatch = true;
        }
        if (a.title.normalized && a.title.normalized === b.title.normalized) {
            matches.push(evidence('Title matches after copy-marker removal', 45));
            score += 45;
            directMatch = true;
        }
        if (a.filename.core.length >= 5 && a.filename.core === b.filename.core) {
            matches.push(evidence('Filename work core matches', 35));
            score += 35;
        }
        if (a.title.core.length >= 5 && a.title.core === b.title.core) {
            matches.push(evidence('Title work core matches', 30));
            score += 30;
        }
        const crossMatch = (a.title.core.length >= 5 && a.title.core === b.filename.core) ||
            (a.filename.core.length >= 5 && a.filename.core === b.title.core);
        if (crossMatch) {
            matches.push(evidence('Title matches the other filename', 20));
            score += 20;
        }

        if (a.composer && b.composer) {
            if (a.composer === b.composer) {
                matches.push(evidence('Composer agrees', 20, [a.displayComposer || b.displayComposer]));
                score += 20;
            } else {
                conflicts.push(evidence('Composer differs', -45, [a.displayComposer, b.displayComposer]));
                score -= 45;
            }
        } else {
            missingEvidence.push(evidence('Composer is unavailable for one item', 0, [a.displayComposer || 'Not provided', b.displayComposer || 'Not provided']));
        }

        score += compareSetEvidence(matches, conflicts, missingEvidence, 'Catalogue number', a.catalogues, b.catalogues, 20, -50);
        score += compareSetEvidence(matches, conflicts, missingEvidence, 'Work number', a.workNumbers, b.workNumbers, 10, -35);
        score += compareSetEvidence(matches, conflicts, missingEvidence, 'Key', a.keys, b.keys, 5, -20);

        const instrumentConflict = a.instruments.size && b.instruments.size && !sameSet(a.instruments, b.instruments);
        const roleConflict = a.roles.size && b.roles.size && !sameSet(a.roles, b.roles);
        if (instrumentConflict || roleConflict) {
            const valuesA = [setLabel(a.instruments), setLabel(a.roles)].filter(Boolean).join('; ') || 'Not provided';
            const valuesB = [setLabel(b.instruments), setLabel(b.roles)].filter(Boolean).join('; ') || 'Not provided';
            conflicts.push(evidence('Instrument or document role differs', -30, [valuesA, valuesB]));
            score -= 30;
        } else if ((a.instruments.size && b.instruments.size) || (a.roles.size && b.roles.size)) {
            matches.push(evidence('Instrument or document role agrees', 5));
            score += 5;
        } else if (a.instruments.size || b.instruments.size || a.roles.size || b.roles.size) {
            missingEvidence.push(evidence('Instrument or document role is unavailable for one item', 0));
        }

        if ((a.copyMarkers.size > 0) !== (b.copyMarkers.size > 0)) {
            matches.push(evidence('One filename or title has an explicit copy marker', 10));
            score += 10;
        }

        score = Math.max(0, Math.min(100, score));
        const category = conflicts.length
            ? 'related'
            : (score >= 55 && directMatch ? 'likely' : (score >= 35 ? 'possible' : null));
        if (!category) return null;

        return { a, b, score, category, directMatch, matches, conflicts, missingEvidence };
    },

    _buildDuplicateGroup(ids, category, identitiesById, pairLookup) {
        const relevantPairs = [];
        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                const pair = pairLookup.get(pairKey(ids[i], ids[j]));
                if (pair && (category === 'related' ? pair.category === 'related' : pair.category === category)) {
                    relevantPairs.push(pair);
                }
            }
        }
        const matches = uniqueEvidence(relevantPairs.flatMap(pair => pair.matches));
        const conflicts = uniqueEvidence(relevantPairs.flatMap(pair => pair.conflicts));
        const missingEvidence = uniqueEvidence(relevantPairs.flatMap(pair => pair.missingEvidence));
        const score = relevantPairs.length ? Math.min(...relevantPairs.map(pair => pair.score)) : 0;
        const items = ids.map(id => identitiesById.get(id)).filter(Boolean);
        return {
            key: `${category}:${ids.join('-')}`,
            category,
            confidence: category === 'likely' ? 'high' : 'low',
            score,
            summary: summarizeGroup(category, matches, conflicts),
            matches,
            conflicts,
            missingEvidence,
            items
        };
    },

    detectDuplicates() {
        const identities = this.data.map(row => duplicateTools._buildDuplicateIdentity.call(this, row));
        const identitiesById = new Map(identities.map(identity => [identity.id, identity]));
        const coreBuckets = new Map();
        identities.forEach(identity => {
            const cores = new Set([identity.title.core, identity.filename.core].filter(core => core.length >= 5));
            cores.forEach(core => {
                if (!coreBuckets.has(core)) coreBuckets.set(core, []);
                coreBuckets.get(core).push(identity.id);
            });
        });

        const candidatePairs = new Map();
        coreBuckets.forEach(ids => {
            for (let i = 0; i < ids.length; i++) {
                for (let j = i + 1; j < ids.length; j++) {
                    candidatePairs.set(pairKey(ids[i], ids[j]), [ids[i], ids[j]]);
                }
            }
        });

        const pairs = [];
        const pairLookup = new Map();
        [...candidatePairs.values()]
            .sort((a, b) => a[0] - b[0] || a[1] - b[1])
            .forEach(([aId, bId]) => {
                const pair = duplicateTools._compareDuplicatePair.call(this, identitiesById.get(aId), identitiesById.get(bId));
                if (!pair) return;
                pairs.push(pair);
                pairLookup.set(pairKey(pair.a.id, pair.b.id), pair);
            });

        const likely = buildCompleteLinkGroups(pairs, 'likely', pairLookup);
        const possible = buildCompleteLinkGroups(pairs, 'possible', pairLookup);
        const related = buildRelatedFamilies(pairs);
        const groups = [
            ...likely.map(ids => duplicateTools._buildDuplicateGroup.call(this, ids, 'likely', identitiesById, pairLookup)),
            ...possible.map(ids => duplicateTools._buildDuplicateGroup.call(this, ids, 'possible', identitiesById, pairLookup)),
            ...related.map(ids => duplicateTools._buildDuplicateGroup.call(this, ids, 'related', identitiesById, pairLookup))
        ];

        return groups.sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] ||
            b.score - a.score || Math.min(...a.items.map(item => item.id)) - Math.min(...b.items.map(item => item.id)));
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
            html += `<label><input class="dup-group-checkbox" data-group-index="${groupIndex}" ${indeterminate} type="checkbox" ${allSelected ? 'checked' : ''} onchange="app.toggleDupGroup(${groupIndex})"> Group ${groupIndex + 1} (${group.items.length} items)</label>`;
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
                html += `<input type="checkbox" ${checked} onchange="app.toggleDupItem(${item.id})" aria-label="Select ${this.escapeHtml(item.displayTitle)} for duplicate review tagging">`;
                html += '<div class="dup-item-info">';
                html += `<div class="dup-item-title">${this.escapeHtml(item.displayTitle)}</div>`;
                html += `<div class="dup-item-meta">${this._renderDuplicateItemMeta(item)}</div>`;
                html += '</div></div>';
            });
            html += '</section>';
        });

        resultsDiv.innerHTML = html;
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

        this.pushUndo('Tag Duplicates');
        let count = 0;
        this._dupSelected.forEach(id => {
            const row = this.dataById.get(id);
            if (!row) return;
            const existingTags = (row[this.tagsField] || '').split(';').map(tag => tag.trim()).filter(Boolean);
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
        this.showNotification('Tagged ' + count + ' file(s) with "_Duplicate_Delete_Me". Compare every tagged file in forScore before deleting anything.');
    },

    closeDuplicateModal() {
        document.getElementById('duplicateModal').classList.remove('active');
    }
};
