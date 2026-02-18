# Regression Checklist: Composer Settings + Extraction/Standardize

This checklist is the lightweight regression suite for composer settings behavior.

It is intentionally anchored to these internal functions:

- `_sanitizeSettings`
- `getComposerAliasMap`
- `getSuggestion`
- `formatComposerName`

and includes one end-to-end UI flow that saves settings then applies **Smart Extract** and **Standardize**.

## Scope covered

1. `first_last` mode saves/displays canonical names in first-last order.
2. Custom alias precedence over built-in aliases.
3. Blacklist suppression (blacklisted alias does not resolve).
4. Sanitization: whitespace/case normalization + dedupe for aliases/blacklist.

## Preconditions (deterministic setup)

1. Open `index.html` in a browser.
2. Click **Settings**.
3. Click **Reset composer settings to defaults**.
4. Save settings.
5. Click **Load Sample Data** on the main screen.

> If re-running in the same browser profile, clear stale data by running `localStorage.removeItem('tidyscore-settings')` in devtools and refresh.

---

## A) Sanitization + custom precedence + blacklist in Settings save

**Functions under test:** `_sanitizeSettings`, `getComposerAliasMap`, `getSuggestion`.

1. Open **Settings**.
2. Set **Composer display format** = `First Last`.
3. In **Editable alias table**, add these rows exactly:
   - Alias key: `  beethoven  ` → Canonical: `  Bee Thoven Custom  `
   - Alias key: `J.S. BACH` → Canonical: ` Johann Sebastian Bach `
4. In **Editable blacklist list**, add these rows exactly:
   - `  j.s. bach  `
   - `J.S. BACH`
5. Save settings.
6. Re-open **Settings**.

### Expected results

- Alias keys are trimmed/lowercased when displayed after re-open:
  - `beethoven`
  - `j.s. bach`
- Canonical values are trimmed (no leading/trailing spaces):
  - `Bee Thoven Custom`
  - `Johann Sebastian Bach`
- Blacklist values are trimmed/lowercased and deduped to one `j.s. bach` row.

These outcomes validate `_sanitizeSettings` normalization and dedupe logic and confirm the saved structure that `getComposerAliasMap` consumes.

---

## B) Smart Extract behavior for precedence + blacklist suppression

**Functions under test:** `getComposerAliasMap`, `getSuggestion`, `formatComposerName`.

1. Ensure sample data is loaded.
2. Add two test rows via inline table editing:
   - Title: `Moonlight Sonata`, Composer: `beethoven`
   - Title: `Prelude in C`, Composer: `j.s. bach`
3. Click **Smart Extract**.
4. In the extraction modal, inspect suggestions for the two rows.

### Expected results

- `beethoven` resolves to **`Bee Thoven Custom`** (custom alias overrides built-in canonical value).
- `j.s. bach` has **no suggestion** (blacklisted alias suppressed even though alias exists in maps).

This verifies custom precedence in `getComposerAliasMap` + lookup in `getSuggestion` + suppression through blacklist removal.

---

## C) First-last formatting in Standardize

**Functions under test:** `formatComposerName` (with saved settings from `_sanitizeSettings`).

1. Keep **Composer display format** set to `First Last`.
2. Ensure there is a row with composer exactly `Beethoven, Ludwig van`.
3. Click **Standardize**.
4. In preview, inspect the transformed composer value for that row.
5. Apply changes.

### Expected results

- Preview and applied value are `Ludwig van Beethoven` (first-last).
- Re-running **Standardize** immediately shows no additional change for that row (idempotent for already formatted value).

This verifies that canonical names display in first-last order when formatting mode is `first_last`.

---

## D) End-to-end flow: save settings → Smart Extract → Standardize

**Functions under test:** all four (`_sanitizeSettings`, `getComposerAliasMap`, `getSuggestion`, `formatComposerName`).

1. Open **Settings** and save the following:
   - Display format: `First Last`
   - Custom alias: `beethoven` → `Ludwig van Beethoven`
   - Blacklist entry: `j.s. bach`
2. Ensure dataset includes these rows:
   - `Composer = beethoven`
   - `Composer = Beethoven, Ludwig van`
   - `Composer = j.s. bach`
3. Run **Smart Extract**, apply all selected changes.
4. Run **Standardize**, apply all selected changes.

### Expected final state

- `beethoven` row becomes `Ludwig van Beethoven` (custom alias + first-last output).
- `Beethoven, Ludwig van` row becomes `Ludwig van Beethoven` (formatting mode applied).
- `j.s. bach` row remains unchanged by extraction (blacklist suppression), and standardize only affects it if user manually changed it to a parseable canonical value.

This scenario is the regression guard for the full user workflow.
