# Conformance suite

Golden input/output cases for TidyScore's cleanup logic, generated from the JavaScript
domain layer in `src/domain`. They exist so another implementation, such as a Swift core
for the iOS app, can prove it behaves exactly like the web app without reading the
JavaScript.

- `cases/*.json` — each file has a `description` naming the function it covers and a list
  of `{ input, expected }` cases. `null` means "no result" or "value unchanged".
- `data/*.json` — the built-in composer aliases, composer eras, and tag keywords. A port
  should bundle these files rather than copy the tables by hand. Tag keyword patterns are
  JavaScript regular expression sources plus flags.

Do not edit these files by hand. After an intentional behavior change in `src/domain`,
run `pnpm conformance` and commit the result; `pnpm test` fails if they drift.

## Porting notes

- Composer canonical names in `composerAliases.json` are stored `Last, First`
  (`Bach, Johann Sebastian`); everything shown to users and written to CSV is `First Last`.
- Diacritic-insensitive matching uses Unicode NFD decomposition and strips combining
  marks U+0300–U+036F.
- Row ids in `sampleLibrary.json` are 0-based indexes into the sample CSV rows.
- CSV output uses CRLF line endings and quotes only fields that need it.
