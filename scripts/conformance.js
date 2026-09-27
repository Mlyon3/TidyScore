// Builds the language-neutral conformance suite in conformance/. The JavaScript domain
// layer is the reference implementation: every case records an input and the output
// src/domain produces for it. Ports (for example a Swift core for the iOS app) load
// these files and must reproduce every expected value.

import { builtInComposerDatabase } from '../src/data/composer-database.js';
import { composerEraDatabase, tagKeywordDatabase } from '../src/data/databases.js';
import { proposeFindReplace, proposeQuickClean } from '../src/domain/cleanup.js';
import {
    buildComposerAliasMap,
    extractComposerFromTitle,
    formatComposerName,
    normalizeComposerValue
} from '../src/domain/composers.js';
import { parseCsvDocument, SAMPLE_LIBRARY_CSV, serializeCsvDocument } from '../src/domain/csv-document.js';
import { resolveLibraryFields } from '../src/domain/data-model.js';
import { detectDuplicates, parseTitleForDedup } from '../src/domain/duplicates.js';
import { getComposerEra } from '../src/domain/genres.js';
import { createLibrary } from '../src/domain/library.js';
import { computeScanResults } from '../src/domain/scan.js';
import { addTag, detectKeyTag, removeTag, renameTags, replaceTag, suggestTagsForTitle, tidyTags } from '../src/domain/tags.js';
import { cleanImslpTitle, needsImslpCleanup } from '../src/domain/titles.js';

export const CONFORMANCE_VERSION = 1;

const sample = parseCsvDocument(SAMPLE_LIBRARY_CSV);
const sampleTitles = sample.rows.map(row => row.Title);
const sampleComposers = [...new Set(sample.rows.map(row => row.Composers))];

const EXTRA_COMPOSERS = [
    'Brahms', 'Brahms, Johannes', 'Johannes Brahms', 'Antonin Dvorak, Johannes Brahms',
    'Brahms, Johannes Brahms', 'j.s. bach', 'J S Bach', 'Frederic Chopin', 'Tchaikovsky',
    'Unknown Person', 'Smith, Jane', '__proto__', 'constructor', '  ', 'bach cpe'
];

const EXTRA_TITLES = [
    'Sonatas Brahms Beethoven', 'Sonatas Brahms Tchiak Beethoven', 'Tchiak Brahms and Beethoven Unknownname',
    'C.P.E. Bach and J.S. Bach', 'Glass Houses and Barber Poles', 'The Barber of Seville',
    'Adagio for Strings (Barber)', 'Suite No. 1 by Bach', 'Dvorak_SQ12', 'Beethoven 5th',
    'Prelude - Bach', 'Einstein on the Beach - Glass', 'Hello', ''
];

const DEDUP_TITLES = [
    'Symphony 5 (2).pdf', 'Sonata for Vln, Op. 27 No. 2 in C# minor.pdf', 'A Little Night Music.pdf',
    'Concerto Full Score Op. 3 No. 1 in C major', 'Suite in B flat major BWV 1010 copy', 'Moonlight Sonata v2'
];

const IMSLP_TITLES = [
    'IMSLP00001-Bach_Cello_Suite_No1.pdf', 'PMLP12345-Some_Work', 'IMSLP123-PMLP456-Etude_No_1',
    '_Leading_Underscore', 'a_b_c_d', 'Plain Title', 'Already (IMSLP)'
];

const TAG_VALUES = ['', 'piano', ' piano ;Keyboard;; piano;alpha', 'b;a;A', 'piano; keyboard', 'Baroque;baroque era'];

function setsToArrays(parsed) {
    return Object.fromEntries(Object.entries(parsed)
        .filter(([key]) => key !== 'modifiers')
        .map(([key, value]) => [key, value instanceof Set ? [...value].sort() : value]));
}

function sampleLibrary() {
    return createLibrary(
        resolveLibraryFields(sample.headers),
        new Map(sample.rows.map((row, index) => [index, { ...row }]))
    );
}

function summarizeGroups(result) {
    if (!result.ok) return { ok: false, code: result.code };
    return {
        ok: true,
        groups: result.result.map(group => ({
            category: group.category,
            ids: group.items.map(item => item.id),
            score: group.score,
            summary: group.summary,
            matches: group.matches.map(entry => entry.label),
            conflicts: group.conflicts.map(entry => entry.label)
        }))
    };
}

function csvCase(name, text) {
    try {
        const parsed = parseCsvDocument(text);
        return { name, input: text, expected: { ok: true, headers: parsed.headers, rows: parsed.rows, serialized: serializeCsvDocument(parsed.headers, parsed.rows) } };
    } catch (error) {
        return { name, input: text, expected: { ok: false, error: error.message } };
    }
}

export function buildConformance() {
    const aliasMap = buildComposerAliasMap();
    const library = sampleLibrary();
    const ids = [...library.rowsById.keys()];

    const cases = {
        composers: {
            description: 'normalizeComposerValue(input, builtInAliasMap) and formatComposerName(input).',
            normalize: [...sampleComposers, ...EXTRA_COMPOSERS].map(input => ({
                input,
                expected: normalizeComposerValue(input, aliasMap)
            })),
            format: ['Bach, Johann Sebastian', 'Beethoven, Ludwig van', 'Satie', 'Erik Satie', ''].map(input => ({
                input,
                expected: formatComposerName(input)
            })),
            era: ['Antonin Dvorak, Johannes Brahms', 'Beethoven, Johannes Brahms', 'Johannes Brahms, Unknown Person', 'bach', ''].map(input => ({
                input,
                expected: getComposerEra(input, aliasMap)
            }))
        },
        titleExtraction: {
            description: 'extractComposerFromTitle(input, builtInAliasMap); null when nothing is found.',
            cases: [...sampleTitles, ...EXTRA_TITLES].map(input => ({
                input,
                expected: extractComposerFromTitle(input, aliasMap)
            }))
        },
        titles: {
            description: 'needsImslpCleanup(input) and cleanImslpTitle(input, addLabel).',
            cases: IMSLP_TITLES.map(input => ({
                input,
                expected: {
                    needsCleanup: needsImslpCleanup(input),
                    withLabel: cleanImslpTitle(input, true),
                    withoutLabel: cleanImslpTitle(input, false)
                }
            }))
        },
        tags: {
            description: 'Tag list edits. null means the value is unchanged.',
            tidy: TAG_VALUES.map(input => ({ input, expected: tidyTags(input) })),
            add: TAG_VALUES.map(input => ({ input, tag: 'Piano', expected: addTag(input, 'Piano') })),
            remove: TAG_VALUES.map(input => ({ input, tag: 'piano', expected: removeTag(input, 'piano') })),
            replace: TAG_VALUES.map(input => ({ input, from: 'keyboard', to: 'Piano', expected: replaceTag(input, 'keyboard', 'Piano') })),
            rename: TAG_VALUES.map(input => ({ input, selected: ['', 'baroque era'], to: 'Baroque', expected: renameTags(input, new Set(['', 'baroque era']), 'Baroque') })),
            keyTag: ['Prelude in C Major', 'Sonata in B-flat minor', 'Etude in F# min.', 'Scherzo in e-moll', 'A Little Night Music'].map(input => ({
                input,
                expected: detectKeyTag(input)
            })),
            suggest: sampleTitles.map(input => ({ input, existing: 'piano', expected: suggestTagsForTitle(input, 'piano', tagKeywordDatabase) }))
        },
        dedupParsing: {
            description: 'parseTitleForDedup(input); sets are emitted as sorted arrays.',
            cases: [...DEDUP_TITLES, ...sampleTitles.slice(0, 10)].map(input => ({ input, expected: setsToArrays(parseTitleForDedup(input)) }))
        },
        sampleLibrary: {
            description: 'Whole-library operations over the sample library; row ids are 0-based row indexes.',
            csv: SAMPLE_LIBRARY_CSV,
            scan: computeScanResults(library, ids, aliasMap),
            quickClean: proposeQuickClean(library, ids),
            findReplace: proposeFindReplace(library, ids, { find: 'No.', replace: 'No. $1', field: 'Title' }),
            duplicates: summarizeGroups(detectDuplicates(library, ids, { aliasMap })),
            duplicatesWithoutAliases: summarizeGroups(detectDuplicates(library, ids))
        },
        csv: {
            description: 'parseCsvDocument(input); serialized is serializeCsvDocument(headers, rows) with CRLF line endings.',
            cases: [
                csvCase('quoted fields and unicode', 'Title,Composers\n"Nocturne, Op. 9",Chopin\nRêverie,"He said ""Hi"""\n'),
                csvCase('byte order mark header', '﻿Title,Tags\nPrelude,piano\n'),
                csvCase('multiline field', 'Title,Notes\nPrelude,"First\nSecond"\n'),
                csvCase('ragged row', 'Title,Composers\nPrelude\n'),
                csvCase('duplicate header', 'Title,Title\nA,B\n'),
                csvCase('empty header', 'Title,\nA,B\n'),
                csvCase('header only', 'Title,Composers\n')
            ]
        }
    };

    const data = {
        composerAliases: builtInComposerDatabase,
        composerEras: composerEraDatabase,
        tagKeywords: tagKeywordDatabase.map(entry => ({
            tag: entry.tag,
            pattern: entry.pattern.source,
            flags: entry.pattern.flags
        }))
    };

    return { version: CONFORMANCE_VERSION, cases, data };
}

export function conformanceFiles() {
    const { version, cases, data } = buildConformance();
    const files = {};
    Object.entries(cases).forEach(([name, value]) => {
        files[`cases/${name}.json`] = { version, ...value };
    });
    Object.entries(data).forEach(([name, value]) => {
        files[`data/${name}.json`] = value;
    });
    return Object.fromEntries(Object.entries(files).map(([path, value]) => [path, `${JSON.stringify(value, null, 2)}\n`]));
}
