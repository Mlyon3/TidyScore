import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { conformanceFiles } from '../scripts/conformance.js';

describe('conformance suite', () => {
    it('matches the current domain behavior (run `pnpm conformance` after intentional changes)', () => {
        Object.entries(conformanceFiles()).forEach(([path, contents]) => {
            const committed = readFileSync(new URL(`../conformance/${path}`, import.meta.url), 'utf8');
            expect(committed, path).toBe(contents);
        });
    });
});
