const FIELD_ALIASES = {
    composer: ['composers', 'composer'],
    title: ['title'],
    genre: ['genre', 'genres'],
    tags: ['tags', 'tag'],
    filename: ['filename', 'file']
};

export function resolveLibraryFields(headers) {
    const headersByNormalizedName = new Map(
        headers.map(header => [header.toLowerCase().trim(), header])
    );
    const resolve = aliases => aliases
        .map(alias => headersByNormalizedName.get(alias))
        .find(Boolean) || null;

    return Object.fromEntries(
        Object.entries(FIELD_ALIASES).map(([field, aliases]) => [field, resolve(aliases)])
    );
}

export function countModifiedFields(data, originalData, headers) {
    const originalsById = new Map(originalData.map(row => [row.__id, row]));
    let count = 0;

    data.forEach(row => {
        const original = originalsById.get(row.__id);
        headers.forEach(header => {
            if (String(row[header] ?? '') !== String(original?.[header] ?? '')) count++;
        });
    });

    return count;
}

export function buildExportDiffSummary(data, originalData, headers) {
    const originalsById = new Map(originalData.map(row => [row.__id, row]));
    const fields = resolveLibraryFields(headers);
    const fieldCounts = new Map();
    const groups = [];

    data.forEach((row, index) => {
        const original = originalsById.get(row.__id);
        if (!original) return;

        const changes = headers.flatMap(field => {
            const oldValue = String(original[field] ?? '');
            const newValue = String(row[field] ?? '');
            if (oldValue === newValue) return [];
            fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
            return [{ field, oldValue, newValue }];
        });

        if (changes.length === 0) return;

        const currentTitle = fields.title ? String(row[fields.title] ?? '').trim() : '';
        const originalTitle = fields.title ? String(original[fields.title] ?? '').trim() : '';
        const currentFilename = fields.filename ? String(row[fields.filename] ?? '').trim() : '';
        const originalFilename = fields.filename ? String(original[fields.filename] ?? '').trim() : '';
        const currentComposer = fields.composer ? String(row[fields.composer] ?? '').trim() : '';
        const originalComposer = fields.composer ? String(original[fields.composer] ?? '').trim() : '';

        groups.push({
            rowId: row.__id,
            rowNum: Number.isInteger(row.__id) ? row.__id + 1 : index + 1,
            title: currentTitle || originalTitle || currentFilename || originalFilename || 'Untitled score',
            composer: currentComposer || originalComposer || 'Composer unknown',
            changes
        });
    });

    return {
        groups,
        changedFieldCount: groups.reduce((total, group) => total + group.changes.length, 0),
        changedScoreCount: groups.length,
        fieldCounts: Object.fromEntries(fieldCounts)
    };
}
