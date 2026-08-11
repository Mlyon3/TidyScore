const ROW_ID = Symbol('tidyscoreRowId');

function defineRowId(row, id) {
    Object.defineProperty(row, ROW_ID, {
        value: id,
        enumerable: false,
        configurable: true,
        writable: false
    });
    return row;
}

export function getRowId(row) {
    return row?.[ROW_ID];
}

export function assignRowIds(rows, ids = null) {
    rows.forEach((row, index) => {
        defineRowId(row, ids?.[index] ?? index);
    });
    return rows;
}

export function rehydrateRowIds(rows) {
    return assignRowIds(rows);
}

export function cloneRowsWithIds(rows) {
    return rows.map((row, index) => {
        const clone = JSON.parse(JSON.stringify(row));
        return defineRowId(clone, getRowId(row) ?? index);
    });
}

export function buildRowsById(rows) {
    return new Map(rows.map(row => [getRowId(row), row]));
}
