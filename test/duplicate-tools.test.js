import { describe, expect, it } from 'vitest';
import { duplicateTools } from '../src/tools/duplicate-tools.js';

function detect(data) {
    return duplicateTools.detectDuplicates.call({
        data,
        titleField: 'Title',
        filenameField: 'Filename',
        composerField: 'Composers',
        parseTitleForDedup: duplicateTools.parseTitleForDedup
    });
}

describe('duplicate detection', () => {
    it('finds duplicate filenames even when both rows have different titles', () => {
        const groups = detect([
            { __id: 0, Title: 'Mozart: Sonata in C Major, K.545', Filename: 'Sonata in C Major K545.pdf' },
            { __id: 1, Title: 'Sonata in C Major K.545', Filename: 'Sonata in C Major K545.pdf' }
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0].items.map(item => item.id)).toEqual([0, 1]);
        expect(groups[0].items.every(item => item.sources.has('filename'))).toBe(true);
    });

    it('finds duplicate normalized titles when filenames differ', () => {
        const groups = detect([
            { __id: 0, Title: 'Moonlight Sonata.pdf', Filename: 'scan-a.pdf' },
            { __id: 1, Title: 'Moonlight Sonata (2).pdf', Filename: 'scan-b.pdf' }
        ]);

        expect(groups.some(group => group.items.length === 2)).toBe(true);
    });

    it('does not duplicate one row within a group when title and filename normalize equally', () => {
        const groups = detect([
            { __id: 0, Title: 'Clair de Lune', Filename: 'Clair de Lune.pdf' },
            { __id: 1, Title: 'Clair de Lune', Filename: 'Clair de Lune.pdf' }
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0].items).toHaveLength(2);
    });
});
