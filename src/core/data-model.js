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
