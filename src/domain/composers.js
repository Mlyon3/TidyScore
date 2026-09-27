// Composer recognition, normalization, and title extraction.
// Pure functions: every lookup takes an explicit alias map built by buildComposerAliasMap().

import { builtInComposerDatabase } from '../data/composer-database.js';
import { DEFAULT_SETTINGS } from '../data/settings-defaults.js';
import { escapeRegex, normalizeAliasKey, stripDiacritics, UNSAFE_OBJECT_KEYS } from './text.js';

// Single-word aliases that are also common English words. They need stronger evidence
// (a full segment, parentheses, or "by" attribution) so "Barber of Seville" does not
// become Samuel Barber.
export const AMBIGUOUS_ALIASES = new Set([
    'glass', 'cage', 'monk', 'reich', 'barber',
    'weber', 'adams', 'davis', 'williams', 'parker', 'holst'
]);

const MULTI_COMPOSER_NON_NAME_WORDS = new Set([
    'and', 'arrangement', 'book', 'collection', 'concerto', 'concertos', 'duet', 'duets',
    'for', 'fugue', 'fugues', 'miniature', 'miniatures', 'music', 'nocturne', 'nocturnes',
    'or', 'piano', 'plus', 'prelude', 'preludes', 'quartet', 'quartets', 'score', 'selections',
    'sonata', 'sonatas', 'suite', 'suites', 'symphonies', 'symphony', 'the', 'trio', 'trios',
    'two', 'variation', 'variations', 'volume', 'with', 'work', 'works', 'bachs'
]);

export function buildComposerAliasMap(settings = DEFAULT_SETTINGS, builtIn = builtInComposerDatabase) {
    const library = settings?.composer?.library || {};
    const mode = library.mode || 'builtin_plus_custom';
    const aliases = {};

    const addAll = source => {
        Object.entries(source || {}).forEach(([key, value]) => {
            if (!UNSAFE_OBJECT_KEYS.has(key)) aliases[key] = value;
        });
    };
    addAll(builtIn);
    if (mode !== 'builtin') addAll(library.customAliases);
    (library.blacklistedAliases || []).forEach(alias => { delete aliases[alias]; });

    return aliases;
}

export function getSuggestion(composer, aliasMap) {
    if (!composer) return null;
    const normalized = normalizeAliasKey(composer);

    if (Object.hasOwn(aliasMap, normalized)) return aliasMap[normalized];

    const strippedInput = stripDiacritics(normalized);
    if (strippedInput !== normalized && Object.hasOwn(aliasMap, strippedInput)) {
        return aliasMap[strippedInput];
    }

    for (const key in aliasMap) {
        if (!Object.hasOwn(aliasMap, key)) continue;
        if (stripDiacritics(key) === strippedInput) return aliasMap[key];
    }

    return null;
}

export function parseComposerName(value) {
    const raw = (value || '').toString().trim();
    if (!raw) return { raw: '', first: '', last: '' };

    if (raw.includes(',')) {
        const [lastPart, ...firstParts] = raw.split(',');
        return { raw, last: (lastPart || '').trim(), first: firstParts.join(',').trim() };
    }

    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { raw, first: '', last: parts[0] };

    const last = parts.pop();
    return { raw, first: parts.join(' ').trim(), last: (last || '').trim() };
}

export function formatComposerName(value) {
    const composer = parseComposerName(value);
    if (!composer.raw) return '';
    return (composer.first ? `${composer.first} ${composer.last}` : composer.last).trim();
}

// Resolves a composer field (possibly a comma-separated list) to First Last form.
export function normalizeComposerValue(value, aliasMap) {
    const raw = (value || '').toString().trim();
    if (!raw) return { entries: [], formatted: '' };

    const resolveSingle = input => {
        const source = input.trim();
        const canonical = getSuggestion(source, aliasMap) || source;
        return { extracted: source, canonical, formatted: formatComposerName(canonical) || source };
    };

    if (getSuggestion(raw, aliasMap)) {
        const entry = resolveSingle(raw);
        return { entries: [entry], formatted: entry.formatted };
    }

    const commaParts = raw.split(',').map(part => part.trim()).filter(Boolean);
    if (commaParts.length === 2) {
        const legacyCanonical = getSuggestion(`${commaParts[1]} ${commaParts[0]}`.trim(), aliasMap);
        if (legacyCanonical) {
            const entry = { extracted: raw, canonical: legacyCanonical, formatted: formatComposerName(legacyCanonical) };
            return { entries: [entry], formatted: entry.formatted };
        }
    }

    const seen = new Set();
    const entries = commaParts.map(resolveSingle).filter(entry => {
        const key = stripDiacritics(entry.formatted.toLowerCase());
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return { entries, formatted: entries.map(entry => entry.formatted).join(', ') };
}

function isAmbiguousSingleWord(candidate) {
    const words = candidate.trim().split(/\s+/);
    return words.length === 1 && AMBIGUOUS_ALIASES.has(candidate.toLowerCase().trim());
}

function tryGetSuggestion(candidate, aliasMap, allowAmbiguous = false) {
    if (!candidate || !candidate.trim()) return null;
    const trimmed = candidate.trim();
    if (!allowAmbiguous && isAmbiguousSingleWord(trimmed)) return null;
    const suggestion = getSuggestion(trimmed, aliasMap);
    return suggestion ? { extracted: trimmed, suggestion } : null;
}

function containsCpeCue(text = '') {
    if (!text || !text.trim()) return false;
    return /\bc\.?\s*p\.?\s*e\.?\b|carl\s+philipp\s+emanuel/iu.test(text);
}

function applyBachContextOverride(suggestion, contextText = '') {
    if (suggestion === 'Bach, Johann Sebastian' && containsCpeCue(contextText)) {
        return 'Bach, Carl Philipp Emanuel';
    }
    return suggestion;
}

function composerAliasPattern(value) {
    return escapeRegex(value).replace(/\s+/g, '\\s+');
}

function findComposerMentions(title, aliasMap) {
    const searchableTitle = stripDiacritics(title.toLowerCase());
    const candidates = [];

    Object.entries(aliasMap).forEach(([alias, canonical]) => {
        const trimmedAlias = alias.trim();
        if (!trimmedAlias || isAmbiguousSingleWord(trimmedAlias)) return;

        const normalizedAlias = stripDiacritics(trimmedAlias.toLowerCase());
        const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${composerAliasPattern(normalizedAlias)})(?=$|[^\\p{L}\\p{N}])`, 'gu');
        let match;
        while ((match = pattern.exec(searchableTitle)) !== null) {
            const start = match.index + match[1].length;
            const end = start + match[2].length;
            candidates.push({ start, end, extracted: title.slice(start, end), canonical });
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
        const key = stripDiacritics(match.canonical.toLowerCase());
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function extractMultipleComposersFromTitle(title, aliasMap) {
    const matches = findComposerMentions(title, aliasMap);
    if (matches.length < 2) return null;

    const masked = title.split('');
    matches.forEach(match => {
        for (let index = match.start; index < match.end; index++) masked[index] = ' ';
    });

    const unresolvedTokens = [...masked.join('').matchAll(/\p{Lu}[\p{L}\p{M}'’-]*/gu)]
        .map(match => match[0])
        .filter(token => !MULTI_COMPOSER_NON_NAME_WORDS.has(token.toLowerCase()));
    const entries = matches.map(match => ({
        extracted: match.extracted,
        canonical: match.canonical,
        formatted: formatComposerName(match.canonical)
    }));

    return {
        extracted: entries.map(entry => entry.extracted).join(', '),
        suggestion: entries[0].canonical,
        matches: entries,
        formattedSuggestion: entries.map(entry => entry.formatted).join(', '),
        isPartial: unresolvedTokens.length > 0,
        unresolvedTokens: [...new Set(unresolvedTokens)]
    };
}

const STRUCTURAL_TITLE_PATTERNS = [
    // "Bach - Prelude" or "J.S. Bach - Air"
    /^([\p{Lu}][\p{Ll}]+(?:\s+[\p{Lu}]\.?\s*[\p{Lu}]\.?\s*)?(?:\s+[\p{Lu}][\p{Ll}]+)?)\s*[-–—]\s*/u,
    // "Dvorak_SQ12"
    /^([\p{Lu}][\p{Ll}]+)_/u,
    // "Bach Suite" or "Beethoven Sonata"
    /^([\p{Lu}][\p{Ll}]+)\s+(?:[Ss]uite|[Ss]onata|[Ss]ymphony|[Cc]oncerto|[Qq]uartet|[Qq]uintet|[Pp]relude|[Ff]ugue|[Cc]antata|[Mm]ass|[Rr]equiem|[Oo]verture|[Rr]hapsody|[Nn]octurne|[EÉeé]tude|[Ww]altz|[Pp]olonaise|[Mm]azurka|[Bb]allade|[Ii]mpromptu|[Vv]ariations|[Ss]erenade|[Dd]ivertimento|[Tt]rio|[Oo]pus|Op\.|No\.)/u,
    // "Bach 3rd" or "Beethoven 5th"
    /^([\p{Lu}][\p{Ll}]+)\s+\d/u
];

function wordPrefixes(words, maxLength, minLength = 1) {
    const candidates = [];
    for (let len = Math.min(words.length - 1, maxLength); len >= minLength; len--) {
        candidates.push(words.slice(0, len).join(' '));
    }
    return candidates;
}

function wordSuffixes(words, maxLength) {
    const candidates = [];
    for (let len = Math.min(words.length - 1, maxLength); len >= 1; len--) {
        candidates.push(words.slice(-len).join(' '));
    }
    return candidates;
}

function firstSuggestion(candidates, aliasMap, allowAmbiguous) {
    for (const candidate of candidates) {
        const result = tryGetSuggestion(candidate, aliasMap, allowAmbiguous);
        if (result) return result;
    }
    return null;
}

function findSingleComposerInTitle(title, aliasMap) {
    // 1. Separator-delimited segments (spaced dashes keep hyphenated names intact).
    const separatorPattern = /\s+[-–—]\s+|[_:|/]/;
    if (separatorPattern.test(title)) {
        const segments = title.split(separatorPattern).map(s => s.trim()).filter(Boolean);
        for (const segment of segments) {
            const words = segment.split(/\s+/);
            const result = tryGetSuggestion(segment, aliasMap, true) ||
                firstSuggestion(wordPrefixes(words, 4), aliasMap, false) ||
                firstSuggestion(wordSuffixes(words, 4), aliasMap, false);
            if (result) return result;
        }
    }

    // 2. Parenthesized attribution.
    const parenMatch = title.match(/\(([^)]+)\)/);
    if (parenMatch) {
        const inner = parenMatch[1].trim();
        const result = tryGetSuggestion(inner, aliasMap, true) ||
            firstSuggestion(wordPrefixes(inner.split(/\s+/), 4), aliasMap, true);
        if (result) return result;
    }

    // 3. "by <composer>".
    const byMatch = title.match(/\bby\s+([\p{L}][\p{L}.\s-]*?)(?:\s*[,)–—|]|\s*$)/iu);
    if (byMatch) {
        const candidate = byMatch[1].trim();
        const result = tryGetSuggestion(candidate, aliasMap, true) ||
            firstSuggestion(wordPrefixes(candidate.split(/\s+/), 4), aliasMap, true);
        if (result) return result;
    }

    // 4. Start-anchored structural patterns.
    for (const pattern of STRUCTURAL_TITLE_PATTERNS) {
        const match = title.match(pattern);
        if (!match) continue;
        const potentialComposer = match[1].trim();
        const suggestion = getSuggestion(potentialComposer, aliasMap);
        if (suggestion) return { extracted: potentialComposer, suggestion };
    }

    // 5. Multi-word prefix scan for titles without separators.
    const prefixResult = firstSuggestion(wordPrefixes(title.split(/\s+/), 5, 2), aliasMap, false);
    if (prefixResult) return prefixResult;

    // 6. First-word fallback (ambiguous words blocked).
    const firstWord = title.split(/[\s\-–—_]/)[0].trim();
    if (firstWord.length > 2) return tryGetSuggestion(firstWord, aliasMap, false);

    return null;
}

export function extractComposerFromTitle(title, aliasMap) {
    if (!title || !title.trim()) return null;
    title = title.trim();

    const multipleResult = extractMultipleComposersFromTitle(title, aliasMap);
    if (multipleResult) return multipleResult;

    const result = findSingleComposerInTitle(title, aliasMap);
    if (!result) return null;

    const suggestion = applyBachContextOverride(result.suggestion, title);
    return {
        ...result,
        suggestion,
        matches: [{ extracted: result.extracted, canonical: suggestion, formatted: formatComposerName(suggestion) }],
        formattedSuggestion: formatComposerName(suggestion),
        isPartial: false,
        unresolvedTokens: []
    };
}

// Composer suggestions for rows: blank composers are inferred from titles, and existing
// composers that are not in First Last canonical form are completed.
export function proposeComposerExtractions(library, ids, aliasMap) {
    const signals = { titleExtractions: [], nameCompletions: [], checked: 0, skipped: 0 };
    const { composer: composerField, title: titleField } = library.fields;
    if (!composerField || !titleField) return signals;

    ids.forEach(id => {
        const row = library.rowsById.get(id);
        if (!row) return;

        const title = row[titleField] || '';
        const currentComposer = row[composerField] || '';

        if (!currentComposer) {
            signals.checked++;
            const result = extractComposerFromTitle(title, aliasMap);
            if (result) signals.titleExtractions.push({ id, title, ...result, type: 'title' });
            return;
        }

        signals.skipped++;
        const normalized = normalizeComposerValue(currentComposer, aliasMap);
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
    });

    return signals;
}

export function proposeComposerStandardization(library, ids, aliasMap) {
    const field = library.fields.composer;
    if (!field) return [];

    return ids.flatMap(id => {
        const row = library.rowsById.get(id);
        const composer = row?.[field];
        if (!composer) return [];
        const trimmed = composer.trim();
        if (!trimmed) return [];
        const newValue = normalizeComposerValue(trimmed, aliasMap).formatted;
        if (!newValue || newValue === trimmed) return [];
        return [{ id, field, oldValue: composer, newValue }];
    });
}

// Counts rows per normalized composer, most frequent first.
export function countComposers(rows, composerField, aliasMap) {
    const counts = new Map();
    if (!composerField) return [];
    rows.forEach(row => {
        const composer = (row[composerField] || '').trim();
        if (!composer) return;
        normalizeComposerValue(composer, aliasMap).entries.forEach(entry => {
            counts.set(entry.formatted, (counts.get(entry.formatted) || 0) + 1);
        });
    });
    return [...counts].sort((a, b) => b[1] - a[1]);
}
