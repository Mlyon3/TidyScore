// A library is { fields, rowsById }: resolved column names (see resolveLibraryFields)
// plus rows keyed by stable row id in import order. Cleanup operations read a library
// and return proposed changes shaped { id, field, oldValue, newValue }.

export function createLibrary(fields, rowsById) {
    return { fields, rowsById };
}

// Writes changes into their rows and returns how many were applied.
export function applyChanges(rowsById, changes) {
    let count = 0;
    changes.forEach(change => {
        const row = rowsById.get(change.id);
        if (!row) return;
        row[change.field] = change.newValue;
        count++;
    });
    return count;
}
