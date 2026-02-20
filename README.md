# TidyScore

A browser-based tool for cleaning up your [forScore](https://forscore.co) music library metadata. Upload your CSV export, fix inconsistencies, and re-import — all without your data ever leaving your browser.

## Setup

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## How to Use

1. Start the app with `npm run dev`.
2. Export your metadata from forScore: **Menu → Share → CSV**.
3. Upload your CSV (or drag and drop it).
4. Clean up your data using the tools below.
5. Export the cleaned CSV and import it back into forScore.

No accounts and no backend required for your data — all CSV processing remains browser-only.

## Project Structure

Application code now lives under `src/` in modular JavaScript and CSS files:

- `src/data` — data definitions, mappings, and constants
- `src/core` — app state and core processing logic
- `src/ui` — rendering, events, and interaction wiring
- `src/tools` — feature-specific cleanup tools (for example duplicate detection)
- `src/styles` — modular stylesheet files imported in order

> Historical note: older builds were maintained as a single-file HTML app. Current development and startup flow uses Vite via the npm scripts above.

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
Scans titles/composers for likely duplicate scores and groups them by confidence so you can review matches quickly. Select matches in the duplicate modal and apply duplicate tags in bulk.

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

- Lightweight deterministic QA checklist for composer-settings regressions: `docs/regression-checklist.md`.

---

## Privacy

All processing happens in your browser. Your CSV data is never uploaded, transmitted, or stored anywhere. The only thing saved is your light/dark mode preference (in localStorage).
