# TidyScore

A browser-based tool for cleaning up your [forScore](https://forscore.co) music library metadata. Upload your CSV export, fix inconsistencies, and re-import — all without your data ever leaving your browser.

## Setup

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Create a production build:

```bash
pnpm build
```

Preview the production build locally:

```bash
pnpm preview
```

Node.js and pnpm are the only required developer tools; Homebrew is not required.

## How to Use

1. Start the app with `pnpm dev`.
2. In forScore, open **Tools → Backups**, tap the **scrolled-page icon**, and choose **Export**.
3. Upload your CSV (or drag and drop it).
4. Clean up your data using the tools below.
5. Review and share or save the cleaned CSV.
6. In forScore, use the main **Import** button to add the CSV if needed, then return to **Tools → Backups → scrolled-page icon → Import** to apply its metadata.

No accounts and no backend required for your data — all CSV processing remains browser-only.

On iPad, TidyScore can be added to the Home Screen for an app-like, offline-capable experience. The production build precaches its revisioned app shell with Workbox after one successful visit. When a new version is ready, TidyScore prompts instead of reloading an active library. Export uses the system share sheet when file sharing is supported and falls back to a normal Files download. Optional session recovery stores the current library only in that browser's local IndexedDB and can be disabled or deleted from the workflow screen.

## Project Structure

Application code now lives under `src/` in modular JavaScript and CSS files:

- `src/data` — data definitions, mappings, and constants
- `src/core` — app state and core processing logic
- `src/ui` — rendering, events, and interaction wiring
- `src/tools` — feature-specific cleanup tools (for example duplicate detection)
- `src/workers` — on-device composer and duplicate analysis workers
- `src/pwa.js` and `src/ui/pwa.js` — generated-service-worker registration and update-safe UI
- `src/styles` — modular stylesheet files imported in order

> Historical note: older builds were maintained as a single-file HTML app. Current development and startup flow uses Vite via the pnpm scripts above.

---


## Current migration status

- ✅ **Modularized in `src/`**: core app logic, UI interactions, data definitions, feature tools (including duplicate tooling), and stylesheet modules.
- ✅ **Vite-based local workflow**: repository root now includes `package.json` scripts (`dev`, `build`, `preview`) and Vite dependency entries as the source of truth for local startup/build.
- ✅ **Explicit browser bindings**: `index.html` contains the static shell and declarative `data-action` hooks; `src/ui/bindings.js` owns the allowlisted event wiring. There are no inline JavaScript handlers or global `window.app` object.
- ✅ **Generated offline shell**: `vite-plugin-pwa` and Workbox generate the service worker, revisioned precache, network-first navigation fallback, immutable-asset caching, and obsolete-cache cleanup.

This section should be updated as remaining inline structure is moved into fully componentized/modules-first architecture.

## Cleanup Tools

### Quick Clean
Fixes the small stuff across your entire library (or selected rows) in one click:
- Trims whitespace from titles and composers
- Normalizes spacing around composer-list separators
- Cleans up tags: trims, deduplicates, removes empties, sorts alphabetically

### Clean IMSLP Titles
If you've imported scores from IMSLP, your titles probably look like `IMSLP00001-Bach_Cello_Suite_No1.pdf`. This strips the IMSLP/PMLP prefixes, converts underscores to spaces, removes `.pdf` extensions, and adds an `(IMSLP)` marker. Preview every change before applying.

### Smart Extract
Detects composer names hiding in your titles. If a score is called "Bach - Cello Suite No. 1" but the composer field is empty, Smart Extract finds it, recognizes "Bach", and suggests "Johann Sebastian Bach". Compilation titles can produce multiple composers in forScore's comma-separated format. Potentially incomplete lists are clearly marked and left unchecked. Smart Extract also catches informal names in the composer field — "beethoven" becomes "Ludwig van Beethoven".

### Find & Replace
Search and replace across any field (title, composer, genre, or tags). Works on selected rows or the entire library.

### Standardize Composers
Applies unambiguous `First Last` formatting to each composer. It converts recognized legacy values such as `Beethoven, Ludwig van` to `Ludwig van Beethoven` and preserves lists such as `Antonín Dvořák, Johannes Brahms`.

### Find Duplicates
Compares structured evidence from titles, filenames, composers, catalogue numbers, keys, work numbers, and instrument or document roles. Results are separated into likely duplicates, possible duplicates, and related material, with an expandable explanation of every match or conflict. Likely duplicates are preselected for bulk review tagging; compare the tagged files in forScore before deleting anything because CSV metadata does not include annotations.

---

## Genre & Tag Tools

Accessed via the **Genre & Tags** dropdown button in the toolbar.

### Suggest Genre
Fills empty genre fields based on the composer's musical era. Covers 90+ composers across Baroque, Classical, Romantic, Impressionist, 20th Century, Contemporary, Jazz, Film, Musical Theatre, Ragtime, and Neo-Classical. Preview and approve every suggestion before applying.

### Suggest Tags
Scans your titles for musical keywords and suggests tags you might be missing. Detects:
- **Instruments**: piano, violin, viola, cello, flute, oboe, clarinet, bassoon, trumpet, horn, trombone, guitar, harp, organ
- **Ensembles**: orchestra, chamber, string quartet, trio, duo, solo
- **Forms**: sonata, concerto, symphony, suite, prelude, fugue, etude, nocturne, waltz, mazurka, polonaise, ballade, scherzo, rondo, aria, requiem, cantata, opera, overture, rhapsody, fantasy, variations, and more
- **Vocal**: choral, lied

Tags are appended to existing tags — nothing gets overwritten.

### Manage Genres & Tags
Browse every unique genre or tag in your library with frequency counts. Select multiple values and rename or merge them in bulk. Perfect for fixing inconsistencies like "Baroque" / "baroque" / "BAROQUE" across thousands of entries.

---

## Working with Selections

All tools are scope-aware:
- **Select rows** with checkboxes, then run any tool — it only affects your selection
- **Search** to filter the table, then use "Select All" — it selects the complete filtered result, including rows on other pages
- The **scope indicator** next to "Your Library" always shows what you're working with

## Other Features

- **Inline editing** — click any cell to edit it directly; composer cells show smart suggestions as you type
- **Sorting** — click column headers to sort; empty values always go to the bottom
- **Adaptive pagination** — filtered libraries above 200 rows render 200 at a time while search, selection, sorting, and tools continue to use the complete filtered result
- **Undo** — Ctrl/Cmd+Z or the Undo button; 50 levels of history
- **Dark mode** — toggle in the header; remembers your preference
- **Export summary** — before downloading, see a log of every change made during your session

## Composer Database

TidyScore recognizes 170+ composer name variations and maps them to their canonical forms. Coverage spans Baroque through Contemporary classical, Jazz, Film/Game scores, Musical Theatre, and crossover artists. Common abbreviations ("J.S. Bach"), informal names ("beethoven"), and misspellings are handled automatically.

Composer names are always written as `First Last`. forScore supports multiple composers in one field separated by commas, for example `Antonín Dvořák, Johannes Brahms`.

## Regression Coverage

- Run the static quality gate with `pnpm lint`.
- Run unit and regression tests with `pnpm test`.
- Run the Chromium smoke suite with `pnpm test:e2e` after installing its browser once with `pnpm exec playwright install chromium`.
- After `pnpm build`, run the production offline suite with `pnpm test:e2e:pwa`.
- GitHub Actions runs lint, tests, the production build, both Chromium suites, diff validation, and a tracked-worktree cleanliness check for pushes and pull requests.
- Run `pnpm audit:release` as a network-dependent release check. Dependency auditing is intentionally not a blocking PR job.
- Dependabot checks pnpm dependencies and GitHub Actions weekly.
- A manual composer-settings checklist remains in `docs/regression-checklist.md`.
- Realistic CSV coverage uses `test/fixtures/forscore-roundtrip.csv`; large-library cases are generated deterministically in tests rather than uploading user data.
- The five-participant workflow protocol and feature decision rubric live in `docs/usability-study.md`.

---

## Privacy

All CSV processing—including worker-based analysis—happens on-device in your browser. CSV contents stay in memory for the current tab and are never uploaded or transmitted by TidyScore. Optional recovery stores the library in that browser's IndexedDB until you disable recovery or delete the copy. Theme and composer-cleanup settings use local storage. TidyScore has no usage counter, telemetry endpoint, remote processing, or uploaded performance data.

## Input and security boundaries

- CSV files and direct text imports are limited to 25 MiB and 25,000 rows. Imports above the validated 5,000-row target remain allowed with a persistent unsupported-scale warning.
- Imports are atomic: invalid, stale, oversized, or over-limit input leaves the current library and filename unchanged.
- Export Review warns when cells begin with optional whitespace followed by `=`, `+`, `-`, or `@`. TidyScore does not rewrite these values, so the exported metadata remains exact.
- A restrictive Content Security Policy limits scripts, workers, images, manifests, and connections to the deployed origin. Inline presentation styles remain allowed; CSP does not make unsafe CSV content trustworthy in other spreadsheet programs.
- See [`docs/threat-model.md`](docs/threat-model.md) for trust assumptions, local-storage behavior, and recovery guidance.
