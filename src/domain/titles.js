// Title cleanup for filenames imported from IMSLP and similar sources.

export function needsImslpCleanup(title) {
    return /IMSLP\d+/.test(title) ||
        /PMLP\d+/.test(title) ||
        /_[A-Z]/.test(title) ||          // underscore before a capital letter
        /^_/.test(title) ||              // leading underscore
        title.split('_').length > 3;     // several underscores
}

export function cleanImslpTitle(title, addLabel = true) {
    let cleaned = title
        .replace(/^IMSLP\d+-?/g, '')
        .replace(/^PMLP\d+-?/g, '')
        .replace(/-PMLP\d+-?/g, '-')
        .replace(/_/g, ' ')
        .replace(/^[-\s]+|[-\s]+$/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\.pdf$/i, '');

    if (addLabel && /IMSLP\d+|PMLP\d+/.test(title) && !cleaned.includes('(IMSLP)')) {
        cleaned += ' (IMSLP)';
    }

    return cleaned.trim();
}

export function proposeImslpCleanup(library, ids, { addLabel = true } = {}) {
    const field = library.fields.title;
    if (!field) return [];

    return ids.flatMap(id => {
        const row = library.rowsById.get(id);
        if (!row) return [];
        const title = row[field] || '';
        if (!needsImslpCleanup(title)) return [];
        const cleaned = cleanImslpTitle(title, addLabel);
        return cleaned === title ? [] : [{ id, field, oldValue: title, newValue: cleaned }];
    });
}
