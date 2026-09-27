import { describe, expect, it } from 'vitest';
import {
    buildComposerAliasMap,
    extractComposerFromTitle,
    normalizeComposerValue
} from '../../src/domain/composers.js';
import { getComposerEra } from '../../src/domain/genres.js';
import { migrateSettings, sanitizeSettings } from '../../src/domain/settings.js';

const aliasMap = buildComposerAliasMap();
const normalize = value => normalizeComposerValue(value, aliasMap);
const extract = title => extractComposerFromTitle(title, aliasMap);

describe('first-last and multi-composer behavior', () => {
    it('normalizes aliases, first-last names, and recognized legacy last-first names', () => {
        expect(normalize('Brahms').formatted).toBe('Johannes Brahms');
        expect(normalize('Johannes Brahms').formatted).toBe('Johannes Brahms');
        expect(normalize('Brahms, Johannes').formatted).toBe('Johannes Brahms');
    });

    it('normalizes and deduplicates comma-separated composers in input order', () => {
        expect(normalize('Antonin Dvorak, Johannes Brahms').formatted)
            .toBe('Antonín Dvořák, Johannes Brahms');
        expect(normalize('Brahms, Johannes Brahms').formatted)
            .toBe('Johannes Brahms');
    });

    it('extracts multiple composers from otherwise unstructured titles', () => {
        const result = extract('Sonatas Brahms Beethoven');

        expect(result.formattedSuggestion).toBe('Johannes Brahms, Ludwig van Beethoven');
        expect(result.matches.map(match => match.extracted)).toEqual(['Brahms', 'Beethoven']);
        expect(result.isPartial).toBe(false);
    });

    it('marks unmatched title-cased text between composer mentions as partial', () => {
        const result = extract('Sonatas Brahms Tchiak Beethoven');

        expect(result.formattedSuggestion).toBe('Johannes Brahms, Ludwig van Beethoven');
        expect(result.isPartial).toBe(true);
        expect(result.unresolvedTokens).toEqual(['Tchiak']);
    });

    it('marks unmatched title-cased text before and after composer mentions as partial', () => {
        const result = extract('Tchiak Brahms and Beethoven Unknownname');

        expect(result.formattedSuggestion).toBe('Johannes Brahms, Ludwig van Beethoven');
        expect(result.isPartial).toBe(true);
        expect(result.unresolvedTokens).toEqual(['Tchiak', 'Unknownname']);
    });

    it('uses longest aliases and keeps distinct Bach identities', () => {
        const result = extract('C.P.E. Bach and J.S. Bach');

        expect(result.formattedSuggestion)
            .toBe('Carl Philipp Emanuel Bach, Johann Sebastian Bach');
        expect(result.matches).toHaveLength(2);
        expect(result.isPartial).toBe(false);
    });

    it('does not treat ambiguous ordinary words as multi-composer evidence', () => {
        expect(extract('Glass Houses and Barber Poles')).toBeNull();
    });

    it('returns an era only when every composer has the same known era', () => {
        expect(getComposerEra('Antonin Dvorak, Johannes Brahms', aliasMap)).toBe('Romantic');
        expect(getComposerEra('Beethoven, Johannes Brahms', aliasMap)).toBeNull();
        expect(getComposerEra('Johannes Brahms, Unknown Person', aliasMap)).toBeNull();
    });

    it('migrates settings while preserving composer-library customizations', () => {
        const migrated = sanitizeSettings(migrateSettings({
            version: 1,
            composer: {
                nameDisplayFormat: 'last_first',
                library: {
                    mode: 'builtin_plus_custom',
                    customAliases: { test: 'Composer, Test' },
                    blacklistedAliases: ['glass']
                }
            },
            normalization: { opusStyle: 'op' }
        }));

        expect(migrated.version).toBe(2);
        expect(migrated.composer).not.toHaveProperty('nameDisplayFormat');
        expect(migrated.composer.library.customAliases).toEqual({ test: 'Test Composer' });
        expect(migrated.composer.library.blacklistedAliases).toEqual(['glass']);
    });

    it('keeps prototype-key composer text plain and rejects unsafe alias keys', () => {
        for (const value of ['__proto__', 'prototype', 'constructor']) {
            expect(normalize(value).formatted).toBe(value);
        }

        const hostile = JSON.parse('{"composer":{"library":{"customAliases":{"__proto__":"Bad","prototype":"Bad","constructor":"Bad","safe":"Bach, Johann Sebastian"}},"unknown":{"nested":{"__proto__":{"polluted":true}}}}}');
        const sanitized = sanitizeSettings(hostile);
        expect(Object.hasOwn(sanitized.composer.library.customAliases, '__proto__')).toBe(false);
        expect(Object.hasOwn(sanitized.composer.library.customAliases, 'prototype')).toBe(false);
        expect(Object.hasOwn(sanitized.composer.library.customAliases, 'constructor')).toBe(false);
        expect(sanitized.composer.library.customAliases.safe).toBe('Johann Sebastian Bach');
        expect(sanitized.composer.unknown.nested).not.toHaveProperty('__proto__');
        expect({}.polluted).toBeUndefined();
    });
});
