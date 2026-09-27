// Evidence-based duplicate detection. Compares structured identity parsed from titles,
// filenames, and composers, then groups pairs into likely / possible / related sets.

import { normalizeComposerValue } from './composers.js';
import { escapeRegex, stripDiacritics } from './text.js';

export const DUPLICATE_PAIR_BUDGET = 250000;
export const DUPLICATE_REVIEW_TAG = '_Duplicate_Delete_Me';

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

function wordsOnly(value) {
    return stripDiacritics(value.toLowerCase())
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function compact(value) {
    return wordsOnly(value).replace(/\s/g, '');
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

export function setLabel(set) {
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

function minimumItemId(items) {
    let minimum = Infinity;
    for (const item of items) {
        if (item.id < minimum) minimum = item.id;
    }
    return minimum;
}

function evidence(label, points, values = []) {
    return { label, points, values };
}

// Composer identity for comparison: token-sorted canonical names, so "Bach, Johann
// Sebastian" and "Johann Sebastian Bach" agree. Without an alias map, raw names are used.
function normalizeComposer(value, aliasMap) {
    const raw = (value || '').toString().trim();
    if (!raw) return '';
    const names = aliasMap
        ? normalizeComposerValue(raw, aliasMap).entries.map(entry => entry.canonical)
        : [raw];
    return names
        .map(name => wordsOnly(name).split(' ').filter(Boolean).sort().join(' '))
        .sort()
        .join('|');
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

export function parseTitleForDedup(value) {
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
}

function buildDuplicateIdentity(id, row, fields, aliasMap) {
    const title = parseTitleForDedup(fields.title ? row[fields.title] : '');
    const filename = parseTitleForDedup(fields.filename ? row[fields.filename] : '');
    return {
        id,
        row,
        displayTitle: (fields.title ? row[fields.title] : '') ||
            (fields.filename ? row[fields.filename] : '') || '',
        displayFilename: fields.filename ? (row[fields.filename] || '') : '',
        displayComposer: fields.composer ? (row[fields.composer] || '') : '',
        composer: normalizeComposer(fields.composer ? row[fields.composer] : '', aliasMap),
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
}

export function compareDuplicatePair(a, b) {
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
}

function buildDuplicateGroup(ids, category, identitiesById, pairLookup) {
    const relevantPairs = [];
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            const pair = pairLookup.get(pairKey(ids[i], ids[j]));
            if (pair && (category === 'related' ? pair.category === 'related' : pair.category === category)) {
                relevantPairs.push(pair);
            }
        }
    }
    const allMatches = [];
    const allConflicts = [];
    const allMissingEvidence = [];
    let score = relevantPairs.length ? Infinity : 0;
    for (const pair of relevantPairs) {
        allMatches.push(...pair.matches);
        allConflicts.push(...pair.conflicts);
        allMissingEvidence.push(...pair.missingEvidence);
        if (pair.score < score) score = pair.score;
    }
    const matches = uniqueEvidence(allMatches);
    const conflicts = uniqueEvidence(allConflicts);
    const missingEvidence = uniqueEvidence(allMissingEvidence);
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
}

// `ids` limits the scope; rows are compared in library order. Returns
// { ok: true, result: groups } or { ok: false, code, message } when the scope is too broad.
export function detectDuplicates(library, ids, { aliasMap = null, pairBudget = DUPLICATE_PAIR_BUDGET } = {}) {
    const budget = Number.isSafeInteger(pairBudget) && pairBudget >= 0 ? pairBudget : DUPLICATE_PAIR_BUDGET;
    const targetSet = new Set(ids);
    const identities = [];
    library.rowsById.forEach((row, id) => {
        if (targetSet.has(id)) identities.push(buildDuplicateIdentity(id, row, library.fields, aliasMap));
    });
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
    for (const bucket of coreBuckets.values()) {
        for (let i = 0; i < bucket.length; i++) {
            for (let j = i + 1; j < bucket.length; j++) {
                const key = pairKey(bucket[i], bucket[j]);
                if (candidatePairs.has(key)) continue;
                if (candidatePairs.size >= budget) {
                    return {
                        ok: false,
                        code: 'DUPLICATE_SCOPE_TOO_BROAD',
                        message: 'This scope has too many possible duplicate pairs. Filter the library or select fewer rows and try again.',
                        details: { pairBudget: budget, scopedRowCount: identities.length }
                    };
                }
                candidatePairs.set(key, [bucket[i], bucket[j]]);
            }
        }
    }

    const pairs = [];
    const pairLookup = new Map();
    [...candidatePairs.values()]
        .sort((a, b) => a[0] - b[0] || a[1] - b[1])
        .forEach(([aId, bId]) => {
            const pair = compareDuplicatePair(identitiesById.get(aId), identitiesById.get(bId));
            if (!pair) return;
            pairs.push(pair);
            pairLookup.set(pairKey(pair.a.id, pair.b.id), pair);
        });

    const groups = [
        ...buildCompleteLinkGroups(pairs, 'likely', pairLookup)
            .map(groupIds => buildDuplicateGroup(groupIds, 'likely', identitiesById, pairLookup)),
        ...buildCompleteLinkGroups(pairs, 'possible', pairLookup)
            .map(groupIds => buildDuplicateGroup(groupIds, 'possible', identitiesById, pairLookup)),
        ...buildRelatedFamilies(pairs)
            .map(groupIds => buildDuplicateGroup(groupIds, 'related', identitiesById, pairLookup))
    ];

    groups.sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] ||
        b.score - a.score || minimumItemId(a.items) - minimumItemId(b.items));
    return { ok: true, result: groups };
}
