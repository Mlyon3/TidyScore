// Genre suggestions from a composer's era. Only unanimous, recognized composers qualify.

import { composerEraDatabase } from '../data/databases.js';
import { getSuggestion, normalizeComposerValue } from './composers.js';

export function getComposerEra(composerValue, aliasMap, eraDatabase = composerEraDatabase) {
    if (!composerValue) return null;
    const entries = normalizeComposerValue(composerValue, aliasMap).entries;
    if (!entries.length) return null;

    const eras = entries.map(entry => {
        if (eraDatabase[entry.canonical]) return eraDatabase[entry.canonical];
        const canonical = getSuggestion(entry.extracted, aliasMap);
        return canonical ? eraDatabase[canonical] || null : null;
    });
    if (eras.some(era => !era)) return null;

    return new Set(eras).size === 1 ? eras[0] : null;
}

export function proposeGenreSuggestions(library, ids, aliasMap, eraDatabase = composerEraDatabase) {
    const { composer: composerField, genre: genreField, title: titleField } = library.fields;
    if (!composerField || !genreField) return [];

    return ids.flatMap(id => {
        const row = library.rowsById.get(id);
        if (!row) return [];
        const genre = (row[genreField] || '').trim();
        const composer = (row[composerField] || '').trim();
        if (genre || !composer) return [];
        const era = getComposerEra(composer, aliasMap, eraDatabase);
        if (!era) return [];
        return [{
            id,
            composer,
            suggestedGenre: era,
            title: titleField ? row[titleField] || '' : '',
            field: genreField,
            oldValue: row[genreField] || '',
            newValue: era
        }];
    });
}
