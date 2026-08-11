import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/main.js';
import { DEFAULT_SETTINGS } from '../src/data/settings-defaults.js';

describe('first-last and multi-composer behavior', () => {
    let app;

    beforeEach(() => {
        app = createApp();
        app.settings = app._deepClone(DEFAULT_SETTINGS);
    });

    it('normalizes aliases, first-last names, and recognized legacy last-first names', () => {
        expect(app.normalizeComposerValue('Brahms').formatted).toBe('Johannes Brahms');
        expect(app.normalizeComposerValue('Johannes Brahms').formatted).toBe('Johannes Brahms');
        expect(app.normalizeComposerValue('Brahms, Johannes').formatted).toBe('Johannes Brahms');
    });

    it('normalizes and deduplicates comma-separated composers in input order', () => {
        expect(app.normalizeComposerValue('Antonin Dvorak, Johannes Brahms').formatted)
            .toBe('Antonín Dvořák, Johannes Brahms');
        expect(app.normalizeComposerValue('Brahms, Johannes Brahms').formatted)
            .toBe('Johannes Brahms');
    });

    it('extracts multiple composers from otherwise unstructured titles', () => {
        const result = app._extractComposerFromTitle('Sonatas Brahms Beethoven');

        expect(result.formattedSuggestion).toBe('Johannes Brahms, Ludwig van Beethoven');
        expect(result.matches.map(match => match.extracted)).toEqual(['Brahms', 'Beethoven']);
        expect(result.isPartial).toBe(false);
    });

    it('marks unmatched title-cased text between composer mentions as partial', () => {
        const result = app._extractComposerFromTitle('Sonatas Brahms Tchiak Beethoven');

        expect(result.formattedSuggestion).toBe('Johannes Brahms, Ludwig van Beethoven');
        expect(result.isPartial).toBe(true);
        expect(result.unresolvedTokens).toEqual(['Tchiak']);
    });

    it('marks unmatched title-cased text before and after composer mentions as partial', () => {
        const result = app._extractComposerFromTitle('Tchiak Brahms and Beethoven Unknownname');

        expect(result.formattedSuggestion).toBe('Johannes Brahms, Ludwig van Beethoven');
        expect(result.isPartial).toBe(true);
        expect(result.unresolvedTokens).toEqual(['Tchiak', 'Unknownname']);
    });

    it('uses longest aliases and keeps distinct Bach identities', () => {
        const result = app._extractComposerFromTitle('C.P.E. Bach and J.S. Bach');

        expect(result.formattedSuggestion)
            .toBe('Carl Philipp Emanuel Bach, Johann Sebastian Bach');
        expect(result.matches).toHaveLength(2);
        expect(result.isPartial).toBe(false);
    });

    it('does not treat ambiguous ordinary words as multi-composer evidence', () => {
        expect(app._extractComposerFromTitle('Glass Houses and Barber Poles')).toBeNull();
    });

    it('returns an era only when every composer has the same known era', () => {
        expect(app.getComposerEra('Antonin Dvorak, Johannes Brahms')).toBe('Romantic');
        expect(app.getComposerEra('Beethoven, Johannes Brahms')).toBeNull();
        expect(app.getComposerEra('Johannes Brahms, Unknown Person')).toBeNull();
    });

    it('migrates settings while preserving composer-library customizations', () => {
        const migrated = app._sanitizeSettings(app._migrateSettings({
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

    it('creates isolated mutable state for each app instance', () => {
        const other = createApp();
        app.data.push({ Title: 'Only here' });
        app.selectedIds.add(12);
        app._ambiguousAliases.add('only-here');

        expect(other.data).toEqual([]);
        expect(other.selectedIds.size).toBe(0);
        expect(other._ambiguousAliases.has('only-here')).toBe(false);
    });

    it('keeps prototype-key composer text plain and rejects unsafe alias keys', () => {
        for (const value of ['__proto__', 'prototype', 'constructor']) {
            expect(app.normalizeComposerValue(value).formatted).toBe(value);
        }

        const hostile = JSON.parse('{"composer":{"library":{"customAliases":{"__proto__":"Bad","prototype":"Bad","constructor":"Bad","safe":"Bach, Johann Sebastian"}},"unknown":{"nested":{"__proto__":{"polluted":true}}}}}');
        const sanitized = app._sanitizeSettings(hostile);
        expect(Object.hasOwn(sanitized.composer.library.customAliases, '__proto__')).toBe(false);
        expect(Object.hasOwn(sanitized.composer.library.customAliases, 'prototype')).toBe(false);
        expect(Object.hasOwn(sanitized.composer.library.customAliases, 'constructor')).toBe(false);
        expect(sanitized.composer.library.customAliases.safe).toBe('Johann Sebastian Bach');
        expect(sanitized.composer.unknown.nested).not.toHaveProperty('__proto__');
        expect({}.polluted).toBeUndefined();
    });
});
