// Tag-list parsing and editing. forScore stores tags as one semicolon-separated field.

export const TAG_SEPARATOR = ';';

export function splitTags(value) {
    return (value || '').split(TAG_SEPARATOR).map(tag => tag.trim()).filter(Boolean);
}

export function joinTags(tags) {
    return tags.join(TAG_SEPARATOR);
}

function sameTag(a, b) {
    return a.toLowerCase() === b.toLowerCase();
}

// Keeps the first spelling of each case-insensitive tag.
export function dedupeTags(tags) {
    const seen = new Set();
    return tags.filter(tag => {
        const key = tag.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// Trims, removes empties, dedupes case-insensitively, and sorts alphabetically.
export function tidyTags(value) {
    return joinTags(dedupeTags(splitTags(value)).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
}

// Each edit returns the new field value, or null when the row does not change.
export function addTag(value, tag) {
    const tags = splitTags(value);
    if (tags.some(existing => sameTag(existing, tag))) return null;
    return joinTags([...tags, tag]);
}

export function removeTag(value, tag) {
    const tags = splitTags(value);
    const kept = tags.filter(existing => !sameTag(existing, tag));
    return kept.length === tags.length ? null : joinTags(kept);
}

export function replaceTag(value, fromTag, toTag) {
    const tags = splitTags(value);
    if (!tags.some(existing => sameTag(existing, fromTag))) return null;
    return joinTags(dedupeTags(tags.map(existing => (sameTag(existing, fromTag) ? toTag : existing))));
}

// Renames any of the exact tag values in `selected` ('' selects rows with no tags).
export function renameTags(value, selected, newName) {
    const raw = (value || '').trim();
    if (!raw) return selected.has('') ? newName : null;
    const tags = raw.split(TAG_SEPARATOR).map(tag => tag.trim());
    if (!tags.some(tag => selected.has(tag))) return null;
    return joinTags(dedupeTags(tags.map(tag => (selected.has(tag) ? newName : tag)).filter(Boolean)));
}

// Applies a tag edit (one of the functions above, partially applied) across rows.
export function proposeTagEdits(library, ids, edit) {
    const field = library.fields.tags;
    if (!field) return [];
    return ids.flatMap(id => {
        const row = library.rowsById.get(id);
        if (!row) return [];
        const oldValue = row[field] || '';
        const newValue = edit(oldValue);
        return newValue === null ? [] : [{ id, field, oldValue, newValue }];
    });
}

export function appendTags(value, newTags) {
    const existing = (value || '').trim();
    const added = joinTags(newTags);
    return existing ? `${existing}${TAG_SEPARATOR}${added}` : added;
}

// Counts tag or genre values across rows for the manager view. Empty values are
// reported first as { value: '', isEmpty: true }.
export function countFieldValues(rows, field, { multiValue = false } = {}) {
    const counts = new Map();
    let emptyCount = 0;
    rows.forEach(row => {
        const raw = (row[field] || '').trim();
        const values = multiValue ? splitTags(raw) : (raw ? [raw] : []);
        if (values.length === 0) {
            emptyCount++;
            return;
        }
        values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
    });

    const sorted = [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, count }));
    if (emptyCount > 0) sorted.unshift({ value: '', count: emptyCount, isEmpty: true });
    return sorted;
}

const KEY_PATTERN = /\b(?:in\s+)?([A-G])[\s-]?([#♯]|flat|[b♭])?\s*[-\s]?(major|minor|maj\.?|min\.?|dur|moll)\b/i;

export function detectKeyTag(title) {
    const match = title.match(KEY_PATTERN);
    if (!match) return null;
    let note = match[1].toUpperCase();
    const accidental = (match[2] || '').toLowerCase();
    if (accidental === '#' || accidental === '♯') note += ' sharp';
    else if (accidental === 'b' || accidental === '♭' || accidental === 'flat') note += ' flat';
    const quality = match[3].toLowerCase();
    const mode = (quality.startsWith('maj') || quality === 'dur') ? 'major' : 'minor';
    return `${note} ${mode}`;
}

export function suggestTagsForTitle(title, existingValue, keywordDatabase) {
    const existing = splitTags(existingValue).map(tag => tag.toLowerCase());
    const suggested = [];
    const consider = tag => {
        if (!existing.includes(tag.toLowerCase()) && !suggested.includes(tag)) suggested.push(tag);
    };
    keywordDatabase.forEach(entry => {
        if (entry.pattern.test(title)) consider(entry.tag);
    });
    const keyTag = detectKeyTag(title);
    if (keyTag) consider(keyTag);
    return suggested;
}

export function proposeTagSuggestions(library, ids, keywordDatabase) {
    const { title: titleField, tags: tagsField } = library.fields;
    if (!titleField || !tagsField) return [];

    return ids.flatMap(id => {
        const row = library.rowsById.get(id);
        const title = (row?.[titleField] || '').trim();
        if (!title) return [];
        const suggestedTags = suggestTagsForTitle(title, row[tagsField], keywordDatabase);
        if (suggestedTags.length === 0) return [];
        return [{
            id,
            title,
            existingTags: row[tagsField] || '',
            suggestedTags,
            field: tagsField,
            oldValue: row[tagsField] || '',
            newValue: appendTags(row[tagsField], suggestedTags)
        }];
    });
}
