import { describe, expect, it, vi } from 'vitest';
import { duplicateTools } from '../src/tools/duplicate-tools.js';

function context(data, overrides = {}) {
    return {
        ...duplicateTools,
        data,
        dataById: new Map(data.map(row => [row.__id, row])),
        titleField: 'Title',
        filenameField: 'Filename',
        composerField: 'Composers',
        tagsField: 'Tags',
        modifiedCount: 0,
        ...overrides
    };
}

function detect(data, overrides = {}) {
    const app = context(data, overrides);
    return duplicateTools.detectDuplicates.call(app);
}

function categories(groups) {
    return groups.map(group => group.category);
}

describe('structured duplicate parsing', () => {
    it('removes copy markers while preserving unlabelled musical numbers', () => {
        const parsed = duplicateTools.parseTitleForDedup('Symphony 5 (2).pdf');
        expect(parsed.normalized).toBe('symphony5');
        expect(parsed.core).toBe('symphony5');
        expect([...parsed.copyMarkers]).toEqual(['numbered copy']);
    });

    it('canonicalizes aliases and retains structured musical identifiers', () => {
        const parsed = duplicateTools.parseTitleForDedup('Sonata for Vln, Op. 27 No. 2 in C# minor.pdf');
        expect([...parsed.instruments]).toEqual(['violin']);
        expect([...parsed.catalogues]).toEqual(['op 27']);
        expect([...parsed.workNumbers]).toEqual(['no 2']);
        expect([...parsed.keys]).toEqual(['C# minor']);
    });

    it('does not mistake a standalone note letter for a musical key', () => {
        const parsed = duplicateTools.parseTitleForDedup('A Little Night Music.pdf');
        expect(parsed.keys.size).toBe(0);
        expect(parsed.core).toBe('alittlenightmusic');
    });
});

describe('evidence-based duplicate detection', () => {
    it('finds duplicate filenames even when titles differ', () => {
        const groups = detect([
            { __id: 0, Title: 'Mozart: Sonata in C Major, K.545', Filename: 'Sonata in C Major K545.pdf', Composers: 'Mozart' },
            { __id: 1, Title: 'Sonata in C Major K.545', Filename: 'Sonata in C Major K545.pdf', Composers: 'Mozart' }
        ]);

        expect(groups[0].category).toBe('likely');
        expect(groups[0].items.map(item => item.id)).toEqual([0, 1]);
        expect(groups[0].matches.some(item => item.label.includes('Filename matches'))).toBe(true);
    });

    it('uses copy markers and composer agreement as visible evidence', () => {
        const groups = detect([
            { __id: 0, Title: 'Moonlight Sonata.pdf', Filename: 'scan-a.pdf', Composers: 'Beethoven, Ludwig van' },
            { __id: 1, Title: 'Moonlight Sonata (2).pdf', Filename: 'scan-b.pdf', Composers: 'Ludwig van Beethoven' }
        ]);

        expect(groups[0].category).toBe('likely');
        expect(groups[0].matches.map(item => item.label)).toEqual(expect.arrayContaining([
            'Title matches after copy-marker removal',
            'Composer agrees',
            'One filename or title has an explicit copy marker'
        ]));
    });

    it('treats missing composer as unknown and conflicting composer as related', () => {
        const missing = detect([
            { __id: 0, Title: 'Nocturne', Filename: 'nocturne-a.pdf', Composers: '' },
            { __id: 1, Title: 'Nocturne', Filename: 'nocturne-b.pdf', Composers: 'Chopin' }
        ]);
        expect(missing[0].category).toBe('likely');
        expect(missing[0].missingEvidence.some(item => item.label.includes('Composer'))).toBe(true);

        const conflict = detect([
            { __id: 0, Title: 'Nocturne', Filename: 'nocturne-a.pdf', Composers: 'Chopin' },
            { __id: 1, Title: 'Nocturne', Filename: 'nocturne-b.pdf', Composers: 'Field' }
        ]);
        expect(conflict[0].category).toBe('related');
        expect(conflict[0].conflicts[0].label).toBe('Composer differs');
    });

    it('uses configured composer aliases when available', () => {
        const aliases = { 'j.s. bach': 'Bach, Johann Sebastian' };
        const groups = detect([
            { __id: 0, Title: 'Prelude', Filename: 'prelude.pdf', Composers: 'J.S. Bach' },
            { __id: 1, Title: 'Prelude copy', Filename: 'prelude-copy.pdf', Composers: 'Bach, Johann Sebastian' }
        ], { getSuggestion: value => aliases[value.toLowerCase()] || null });
        expect(groups[0].category).toBe('likely');
        expect(groups[0].matches.some(item => item.label === 'Composer agrees')).toBe(true);
    });

    it('classifies key, catalogue, number, instrument, and role conflicts as related', () => {
        const groups = detect([
            { __id: 0, Title: 'Concerto Full Score Op. 3 No. 1 in C major', Filename: 'concerto-score.pdf', Composers: 'Example' },
            { __id: 1, Title: 'Concerto Violin Part Op. 4 No. 2 in D minor', Filename: 'concerto-part.pdf', Composers: 'Example' }
        ]);
        expect(groups[0].category).toBe('related');
        expect(groups[0].conflicts.map(item => item.label)).toEqual(expect.arrayContaining([
            'Catalogue number differs',
            'Work number differs',
            'Key differs',
            'Instrument or document role differs'
        ]));
    });

    it('combines title, filename, and cross-field evidence without repeating a row', () => {
        const groups = detect([
            { __id: 0, Title: 'Clair de Lune', Filename: 'Clair de Lune.pdf', Composers: 'Debussy' },
            { __id: 1, Title: 'Clair de Lune', Filename: 'Clair de Lune.pdf', Composers: 'Debussy' }
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0].items).toHaveLength(2);
        expect(groups[0].score).toBe(100);
    });

    it('is symmetric when row order is reversed', () => {
        const rows = [
            { __id: 0, Title: 'Sonata Violin Part in C major', Filename: 'sonata-vln.pdf', Composers: 'Example' },
            { __id: 1, Title: 'Sonata Piano Part in D minor', Filename: 'sonata-pno.pdf', Composers: 'Example' }
        ];
        const forward = detect(rows)[0];
        const reverseRows = [...rows].reverse().map((row, id) => ({ ...row, __id: id }));
        const reverse = detect(reverseRows)[0];
        expect(reverse.category).toBe(forward.category);
        expect(reverse.score).toBe(forward.score);
        expect(reverse.conflicts.map(item => item.label).sort()).toEqual(forward.conflicts.map(item => item.label).sort());
    });

    it('creates a likely copy subgroup and a separate related family', () => {
        const groups = detect([
            { __id: 0, Title: 'Concerto Full Score', Filename: 'concerto-score.pdf', Composers: 'Example' },
            { __id: 1, Title: 'Concerto Full Score (2)', Filename: 'concerto-score-copy.pdf', Composers: 'Example' },
            { __id: 2, Title: 'Concerto Violin Part', Filename: 'concerto-violin-part.pdf', Composers: 'Example' }
        ]);
        expect(categories(groups)).toEqual(['likely', 'related']);
        expect(groups[0].items.map(item => item.id)).toEqual([0, 1]);
        expect(groups[1].items.map(item => item.id)).toEqual([0, 1, 2]);
    });

    it('uses complete-link clustering instead of upgrading a weak transitive match', () => {
        const realGroups = detect([
            { __id: 0, Title: 'Suite Full Score', Filename: 'suite.pdf', Composers: 'Composer' },
            { __id: 1, Title: 'Suite Full Score copy', Filename: 'suite-copy.pdf', Composers: 'Composer' },
            { __id: 2, Title: 'Suite Full Score', Filename: 'other-scan.pdf', Composers: '' }
        ]);
        expect(realGroups.filter(group => group.category === 'likely').every(group =>
            group.items.every((left, i) => group.items.slice(i + 1).every(right => {
                const compared = duplicateTools._compareDuplicatePair.call(context([]), left, right);
                return compared.category === 'likely';
            }))
        )).toBe(true);
    });
});

describe('duplicate review tagging', () => {
    it('tags unique selected rows once, preserves tags, and remains undoable', () => {
        const rows = [
            { __id: 0, Tags: 'Favorite' },
            { __id: 1, Tags: '_Duplicate_Delete_Me' }
        ];
        const app = context(rows, {
            _dupSelected: new Set([0, 1]),
            pushUndo: vi.fn(),
            logChange: vi.fn(),
            closeDuplicateModal: vi.fn(),
            renderTable: vi.fn(),
            updateStats: vi.fn(),
            showNotification: vi.fn()
        });

        duplicateTools.applyDuplicateTags.call(app);
        expect(rows[0].Tags).toBe('Favorite; _Duplicate_Delete_Me');
        expect(rows[1].Tags).toBe('_Duplicate_Delete_Me');
        expect(app.modifiedCount).toBe(1);
        expect(app.pushUndo).toHaveBeenCalledWith('Tag Duplicates');
        expect(app.showNotification).toHaveBeenCalledWith(expect.stringContaining('Compare every tagged file'));
    });
});
