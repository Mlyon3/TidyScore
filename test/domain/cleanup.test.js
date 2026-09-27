import { describe, expect, it } from 'vitest';
import { proposeFindReplace, proposeQuickClean } from '../../src/domain/cleanup.js';
import { buildComposerAliasMap } from '../../src/domain/composers.js';
import { applyChanges, createLibrary } from '../../src/domain/library.js';
import { computeScanResults } from '../../src/domain/scan.js';
import { addTag, removeTag, renameTags, replaceTag, tidyTags } from '../../src/domain/tags.js';
import { cleanImslpTitle, proposeImslpCleanup } from '../../src/domain/titles.js';

const FIELDS = { title: 'Title', composer: 'Composers', genre: 'Genre', tags: 'Tags', filename: null };

function library(rows) {
    return createLibrary(FIELDS, new Map(rows.map((row, index) => [index, { ...row }])));
}

describe('tag editing', () => {
    it('tidies, dedupes case-insensitively, and sorts', () => {
        expect(tidyTags(' piano ;Keyboard;; piano;alpha')).toBe('alpha;Keyboard;piano');
    });

    it('returns null when an edit would not change the value', () => {
        expect(addTag('Piano;study', 'piano')).toBeNull();
        expect(removeTag('piano', 'violin')).toBeNull();
        expect(replaceTag('piano', 'violin', 'viola')).toBeNull();
        expect(renameTags('piano', new Set(['violin']), 'viola')).toBeNull();
    });

    it('edits with one separator so Quick Clean does not re-flag batch edits', () => {
        const added = addTag('piano;keyboard', 'study');
        expect(added).toBe('piano;keyboard;study');
        expect(replaceTag('piano; keyboard', 'keyboard', 'Piano')).toBe('piano');
        expect(tidyTags(removeTag('alpha;beta', 'beta'))).toBe('alpha');
    });

    it('renames selected tags and fills empty rows when "(empty)" is selected', () => {
        expect(renameTags('Baroque;baroque era', new Set(['baroque era']), 'Baroque')).toBe('Baroque');
        expect(renameTags('', new Set(['']), 'Untagged')).toBe('Untagged');
    });
});

describe('find and replace', () => {
    it('treats both the search and the replacement as literal text', () => {
        const lib = library([{ Title: 'Sonata (1.0) $5', Composers: '' }]);
        const [change] = proposeFindReplace(lib, [0], { find: '(1.0)', replace: '$& $1', field: 'Title' });
        expect(change.newValue).toBe('Sonata $& $1 $5');
    });

    it('proposes nothing for an empty search', () => {
        expect(proposeFindReplace(library([{ Title: 'A' }]), [0], { find: '', replace: 'B', field: 'Title' })).toEqual([]);
    });
});

describe('quick clean', () => {
    it('proposes one change per affected field and applies them', () => {
        const lib = library([{ Title: ' Prelude ', Composers: 'Bach, ', Tags: 'b;a;A', Genre: '' }]);
        const changes = proposeQuickClean(lib, [0]);
        expect(changes.map(change => [change.field, change.newValue])).toEqual([
            ['Composers', 'Bach'],
            ['Title', 'Prelude'],
            ['Tags', 'a;b']
        ]);
        expect(applyChanges(lib.rowsById, changes)).toBe(3);
        expect(proposeQuickClean(lib, [0])).toEqual([]);
    });
});

describe('IMSLP titles', () => {
    it('strips IMSLP identifiers and underscores, labelling IMSLP sources', () => {
        expect(cleanImslpTitle('IMSLP00001-Bach_Cello_Suite_No1.pdf')).toBe('Bach Cello Suite No1 (IMSLP)');
        expect(cleanImslpTitle('IMSLP00001-Bach_Cello_Suite_No1.pdf', false)).toBe('Bach Cello Suite No1');
    });

    it('only proposes titles that actually change', () => {
        const lib = library([{ Title: 'Clean Title' }, { Title: 'Some_Title_With_Parts' }]);
        expect(proposeImslpCleanup(lib, [0, 1]).map(change => change.id)).toEqual([1]);
    });
});

describe('scan results', () => {
    it('counts each checklist category for the scoped rows', () => {
        const lib = library([
            { Title: 'Bach - Prelude', Composers: '', Genre: '', Tags: '' },
            { Title: 'Nocturne', Composers: 'chopin', Genre: '', Tags: 'b;a' },
            { Title: 'IMSLP123-Etude_No_1', Composers: 'Frédéric Chopin', Genre: '', Tags: '' }
        ]);
        const scan = computeScanResults(lib, [0, 1, 2], buildComposerAliasMap());
        expect(scan.counts).toEqual({ missingComposer: 2, composerFormatting: 1, imslpTitles: 1, quickClean: 1 });
        expect(scan.extractionSignals).toEqual({ checked: 1, skipped: 2, titleCount: 1, completionCount: 1 });
    });
});
