// The "recommended fixes" checklist: which rows each cleanup would touch.

import { proposeComposerExtractions, proposeComposerStandardization } from './composers.js';
import { proposeQuickClean } from './cleanup.js';
import { proposeImslpCleanup } from './titles.js';

export const SCAN_CATEGORIES = ['missingComposer', 'composerFormatting', 'imslpTitles', 'quickClean'];

export function computeScanResults(library, ids, aliasMap) {
    const extraction = proposeComposerExtractions(library, ids, aliasMap);
    const candidates = {
        missingComposer: [...new Set([
            ...extraction.titleExtractions.map(item => item.id),
            ...extraction.nameCompletions.map(item => item.id)
        ])],
        composerFormatting: proposeComposerStandardization(library, ids, aliasMap).map(change => change.id),
        imslpTitles: proposeImslpCleanup(library, ids).map(change => change.id),
        // One entry per changed field, matching the Quick Clean preview count.
        quickClean: proposeQuickClean(library, ids)
    };

    return {
        counts: Object.fromEntries(SCAN_CATEGORIES.map(key => [key, candidates[key].length])),
        candidates,
        extractionSignals: {
            checked: extraction.checked,
            skipped: extraction.skipped,
            titleCount: extraction.titleExtractions.length,
            completionCount: extraction.nameCompletions.length
        }
    };
}
