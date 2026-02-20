# Extraction Map

This map tracks sections being extracted from `index.html` into `src/` modules/partials.

## JavaScript

| Source section in `index.html` | Extracted target | Notes |
| --- | --- | --- |
| `// ===== Duplicate Detection =====` block (`parseTitleForDedup` through `closeDuplicateModal`) | `src/tools/duplicate-tools.js` | Methods exported as `duplicateTools` and merged into `app` in `src/main.js` via `Object.assign(...)` so inline handlers continue to work. |

## CSS

| Source section in `index.html` | Extracted target | Notes |
| --- | --- | --- |
| `/* ===== Duplicate Detection ===== */` styles (`.dup-*`) | `src/styles/duplicate-detection.css` | Imported from `src/styles/index.css`. |
