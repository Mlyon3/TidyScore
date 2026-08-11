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

## How to Use

1. Start the app with `pnpm dev`.
2. In forScore, open **Tools → Backups**, tap the **scrolled-page icon**, and choose **Export**.
3. Upload your CSV (or drag and drop it).
4. Clean up your data using the tools below.
5. Review and share or save the cleaned CSV.
6. In forScore, use the main **Import** button to add the CSV if needed, then return to **Tools → Backups → scrolled-page icon → Import** to apply its metadata.

No accounts and no backend required for your data — all CSV processing remains browser-only.

On iPad, TidyScore can be added to the Home Screen for an app-like, offline-capable experience. Export uses the system share sheet when file sharing is supported and falls back to a normal Files download. Optional session recovery stores the current library only in that browser's local IndexedDB and can be disabled or deleted from the workflow screen.

## Project Structure

Application code now lives under `src/` in modular JavaScript and CSS files:

- `src/data` — data definitions, mappings, and constants
- `src/core` — app state and core processing logic
- `src/ui` — rendering, events, and interaction wiring
- `src/tools` — feature-specific cleanup tools (for example duplicate detection)
- `src/styles` — modular stylesheet files imported in order

> Historical note: older builds were maintained as a single-file HTML app. Current development and startup flow uses Vite via the pnpm scripts above.

---


## Current migration status

- ✅ **Modularized in `src/`**: core app logic, UI interactions, data definitions, feature tools (including duplicate tooling), and stylesheet modules.
- ✅ **Vite-based local workflow**: repository root now includes `package.json` scripts (`dev`, `build`, `preview`) and Vite dependency entries as the source of truth for local startup/build.
- ⚠️ **Still inline in `index.html`**: the application shell markup and static structure remain in the root HTML file while importing the modular runtime from `src/main.js`.

This section should be updated as remaining inline structure is moved into fully componentized/modules-first architecture.

## Cleanup Tools

### Quick Clean
Fixes the small stuff across your entire library (or selected rows) in one click:
- Trims whitespace from titles and composers
- Fixes trailing commas in composer names
- Cleans up tags: trims, deduplicates, removes empties, sorts alphabetically

### Clean IMSLP Titles
If you've imported scores from IMSLP, your titles probably look like `IMSLP00001-Bach_Cello_Suite_No1.pdf`. This strips the IMSLP/PMLP prefixes, converts underscores to spaces, removes `.pdf` extensions, and adds an `(IMSLP)` marker. Preview every change before applying.

### Smart Extract
Detects composer names hiding in your titles. If a score is called "Bach - Cello Suite No. 1" but the composer field is empty, Smart Extract finds it, recognizes "Bach", and suggests "Bach, Johann Sebastian". Also catches informal names in the composer field — "beethoven" becomes "Beethoven, Ludwig van".

### Find & Replace
Search and replace across any field (title, composer, genre, or tags). Works on selected rows or the entire library.

### Standardize Composers
Converts composer names from "First Last" to "Last, First" format. Handles complex names like "Ludwig van Beethoven" → "Beethoven, Ludwig van".

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
- **Search** to filter the table, then use "Select All" — it selects only visible rows
- The **scope indicator** next to "Your Library" always shows what you're working with

## Other Features

- **Inline editing** — click any cell to edit it directly; composer cells show smart suggestions as you type
- **Sorting** — click column headers to sort; empty values always go to the bottom
- **Undo** — Ctrl/Cmd+Z or the Undo button; 50 levels of history
- **Dark mode** — toggle in the header; remembers your preference
- **Export summary** — before downloading, see a log of every change made during your session

## Composer Database

TidyScore recognizes 170+ composer name variations and maps them to their canonical forms. Coverage spans Baroque through Contemporary classical, Jazz, Film/Game scores, Musical Theatre, and crossover artists. Common abbreviations ("J.S. Bach"), informal names ("beethoven"), and misspellings are handled automatically.

## Regression Coverage

- Run unit and regression tests with `pnpm test`.
- Run the Chromium smoke suite with `pnpm test:e2e` after installing its browser once with `pnpm exec playwright install chromium`.
- GitHub Actions runs tests, the production build, and the browser smoke suite for pushes and pull requests.
- A manual composer-settings checklist remains in `docs/regression-checklist.md`.
- The five-participant workflow protocol and feature decision rubric live in `docs/usability-study.md`.

---

## Privacy

All CSV processing happens in your browser. CSV contents stay in memory for the current tab and are never uploaded or transmitted by TidyScore. The app stores your theme and composer-cleanup settings in your browser's local storage so they persist between visits. TidyScore has no usage counter or telemetry endpoint.
