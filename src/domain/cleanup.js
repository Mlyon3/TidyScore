// Whitespace/tag tidying and literal find & replace, expressed as proposed field changes.

import { tidyTags } from './tags.js';
import { escapeRegex } from './text.js';

function cleanComposerWhitespace(composer) {
    let result = composer.trim();
    if (result && result.includes(',') && result.split(',')[1].trim() === '') {
        result = result.replace(/,\s*$/, '');
    }
    return result;
}

export function proposeQuickClean(library, ids) {
    const { composer: composerField, title: titleField, tags: tagsField } = library.fields;

    return ids.flatMap(id => {
        const row = library.rowsById.get(id);
        if (!row) return [];
        const changes = [];
        const propose = (field, newValue) => {
            const oldValue = row[field] || '';
            if (newValue !== oldValue) changes.push({ id, field, oldValue, newValue });
        };

        if (composerField) propose(composerField, cleanComposerWhitespace(row[composerField] || ''));
        if (titleField) propose(titleField, (row[titleField] || '').trim());
        if (tagsField && row[tagsField]) propose(tagsField, tidyTags(row[tagsField]));
        return changes;
    });
}

export function proposeFindReplace(library, ids, { find, replace, field }) {
    if (!find || !field) return [];
    const pattern = new RegExp(escapeRegex(find), 'g');

    return ids.flatMap(id => {
        const row = library.rowsById.get(id);
        const oldValue = row?.[field];
        if (!oldValue || !oldValue.includes(find)) return [];
        const newValue = oldValue.replace(pattern, () => replace);
        return newValue === oldValue ? [] : [{ id, field, oldValue, newValue }];
    });
}
