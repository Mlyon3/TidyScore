import { describe, expect, it } from 'vitest';
import { tagTools } from '../src/tools/tag-tools.js';
import { assignRowIds, buildRowsById } from '../src/core/row-identity.js';

describe('tag and genre value counting', () => {
    it('treats prototype-key values as ordinary metadata', () => {
        const data = assignRowIds([
            { Genre: '__proto__', Tags: 'constructor;prototype;__proto__' },
            { Genre: '__proto__', Tags: 'constructor' }
        ]);
        const app = {
            ...tagTools,
            dataById: buildRowsById(data),
            tagsField: 'Tags',
            genreField: 'Genre',
            managerTab: 'tags',
            getTargetIds: () => [0, 1]
        };

        tagTools.computeManagerData.call(app);
        expect(app.managerData).toEqual([
            { value: 'constructor', count: 2 },
            { value: '__proto__', count: 1 },
            { value: 'prototype', count: 1 }
        ]);

        app.managerTab = 'genres';
        tagTools.computeManagerData.call(app);
        expect(app.managerData).toEqual([{ value: '__proto__', count: 2 }]);
    });
});
