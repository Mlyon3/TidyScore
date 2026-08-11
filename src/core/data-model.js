import { getRowId } from './row-identity.js';

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
    const originalsById = new Map(originalData.map(row => [getRowId(row), row]));
    let count = 0;

    data.forEach(row => {
        const original = originalsById.get(getRowId(row));
        headers.forEach(header => {
            if (String(row[header] ?? '') !== String(original?.[header] ?? '')) count++;
        });
    });

    return count;
}

export function buildExportDiffSummary(data, originalData, headers) {
    const originalsById = new Map(originalData.map(row => [getRowId(row), row]));
    const fields = resolveLibraryFields(headers);
    const fieldCounts = new Map();
    const groups = [];

    data.forEach((row, index) => {
        const rowId = getRowId(row);
        const original = originalsById.get(rowId);
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
        const currentComposer = fields.composer ? String(row[fields.composer] ?? '').trim() : '';
        const originalComposer = fields.composer ? String(original[fields.composer] ?? '').trim() : '';

        groups.push({
            rowId,
            rowNum: Number.isInteger(rowId) ? rowId + 1 : index + 1,
            title: currentTitle || originalTitle || 'Untitled score',
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

function exportCandidateKey(rowId, field) {
    return `${rowId}\u0000${field}`;
}

export function buildExportReviewSummary(data, originalData, headers, candidates = new Map()) {
    const originalsById = new Map(originalData.map(row => [getRowId(row), row]));
    const rowsById = new Map(data.map(row => [getRowId(row), row]));
    const headerSet = new Set(headers);

    candidates.forEach((candidate, key) => {
        const original = originalsById.get(candidate.rowId);
        if (!rowsById.has(candidate.rowId) || !original || !headerSet.has(candidate.field)) {
            candidates.delete(key);
            return;
        }
        candidate.originalValue = String(original[candidate.field] ?? '');
        if (candidate.proposedValue === candidate.originalValue) candidates.delete(key);
    });

    data.forEach(row => {
        const rowId = getRowId(row);
        const original = originalsById.get(rowId);
        if (!original) return;
        headers.forEach(field => {
            const originalValue = String(original[field] ?? '');
            const currentValue = String(row[field] ?? '');
            if (currentValue === originalValue) return;

            const key = exportCandidateKey(rowId, field);
            const existing = candidates.get(key);
            if (!existing || existing.originalValue !== originalValue) {
                candidates.set(key, {
                    rowId,
                    field,
                    originalValue,
                    proposedValue: currentValue
                });
            } else if (currentValue !== existing.proposedValue) {
                existing.proposedValue = currentValue;
            }
        });
    });

    const fields = resolveLibraryFields(headers);
    const fieldCounts = new Map();
    const groups = [];
    let changedFieldCount = 0;
    let changedScoreCount = 0;
    let revertedCount = 0;

    data.forEach((row, index) => {
        const rowId = getRowId(row);
        const original = originalsById.get(rowId);
        if (!original) return;

        const changes = headers.flatMap(field => {
            const candidate = candidates.get(exportCandidateKey(rowId, field));
            if (!candidate) return [];

            const currentValue = String(row[field] ?? '');
            if (currentValue !== candidate.originalValue && currentValue !== candidate.proposedValue) {
                candidate.proposedValue = currentValue;
            }
            if (candidate.proposedValue === candidate.originalValue) {
                candidates.delete(exportCandidateKey(rowId, field));
                return [];
            }

            const included = currentValue === candidate.proposedValue;
            if (included) {
                changedFieldCount++;
                fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
            } else {
                revertedCount++;
            }
            return [{
                field,
                oldValue: candidate.originalValue,
                newValue: candidate.proposedValue,
                included
            }];
        });

        if (changes.length === 0) return;
        if (changes.some(change => change.included)) changedScoreCount++;

        const currentTitle = fields.title ? String(row[fields.title] ?? '').trim() : '';
        const originalTitle = fields.title ? String(original[fields.title] ?? '').trim() : '';
        const currentComposer = fields.composer ? String(row[fields.composer] ?? '').trim() : '';
        const originalComposer = fields.composer ? String(original[fields.composer] ?? '').trim() : '';

        groups.push({
            rowId,
            rowNum: Number.isInteger(rowId) ? rowId + 1 : index + 1,
            title: currentTitle || originalTitle || 'Untitled score',
            composer: currentComposer || originalComposer || 'Composer unknown',
            details: {
                title: fields.title ? String(row[fields.title] ?? '') : null,
                composer: fields.composer ? String(row[fields.composer] ?? '') : null,
                genre: fields.genre ? String(row[fields.genre] ?? '') : null,
                tags: fields.tags ? String(row[fields.tags] ?? '') : null
            },
            changes
        });
    });

    return {
        groups,
        changedFieldCount,
        changedScoreCount,
        revertedCount,
        candidateCount: changedFieldCount + revertedCount,
        fieldCounts: Object.fromEntries(fieldCounts)
    };
}

const FORMULA_RISK_PATTERN = /^\s*[=+\-@]/;

export function detectFormulaRisks(headers, rows) {
    let cellCount = 0;
    let rowCount = 0;
    for (const row of rows) {
        let rowHasRisk = false;
        for (const header of headers) {
            if (FORMULA_RISK_PATTERN.test(String(row[header] ?? ''))) {
                cellCount++;
                rowHasRisk = true;
            }
        }
        if (rowHasRisk) rowCount++;
    }
    return { cellCount, rowCount };
}
