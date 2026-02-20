# Extraction Map

This map tracks sections extracted from `index.html` into `src/` modules/partials.

## JavaScript

### Duplicate detection (single source of truth)

| Responsibility | Source of truth | Integration point |
| --- | --- | --- |
| Duplicate parsing/detection/UI actions (`parseTitleForDedup` → `closeDuplicateModal`) | `src/tools/duplicate-tools.js` | `index.html` loads a module script, imports `mergeToolsIntoApp` from `src/main.js`, merges tools into the inline `app`, then sets `window.app = ...` so inline `onclick="app..."` handlers continue to work. |

There is no duplicate-detection implementation left inside the inline `app` object in `index.html`.

## CSS

### Foundational styles

| Source range in original `<style>` block | Extracted target |
| --- | --- |
| Top of block through `/* ===== App Header ===== */` (`:root` + `[data-theme="dark"]` variables) | `src/styles/variables.css` |
| Top of block through `/* ===== App Header ===== */` (universal reset + `body`) | `src/styles/base.css` |

### Section delimiter mapping (source-of-truth order)

| Source range in original `<style>` block | Extracted target |
| --- | --- |
| `/* ===== App Header ===== */` → before `/* ===== Upload Section ===== */` | `src/styles/app-header.css` |
| `/* ===== Upload Section ===== */` → before `/* ===== Stats Grid ===== */` | `src/styles/upload-section.css` |
| `/* ===== Stats Grid ===== */` → before `/* ===== Table Section ===== */` | `src/styles/stats-grid.css` |
| `/* ===== Table Section ===== */` → before `/* ===== Buttons ===== */` | `src/styles/table-section.css` |
| `/* ===== Buttons ===== */` → before `/* ===== Table ===== */` | `src/styles/buttons.css` |
| `/* ===== Table ===== */` → before `/* ===== Suggestions Dropdown ===== */` | `src/styles/table.css` |
| `/* ===== Suggestions Dropdown ===== */` → before `/* ===== Modals ===== */` | `src/styles/suggestions-dropdown.css` |
| `/* ===== Modals ===== */` → before `/* ===== Extraction Results ===== */` | `src/styles/modals.css` |
| `/* ===== Extraction Results ===== */` → before `/* ===== Duplicate Detection ===== */` | `src/styles/extraction-results.css` |
| `/* ===== Duplicate Detection ===== */` → before `/* ===== Notifications ===== */` | `src/styles/duplicate-detection.css` |
| `/* ===== Notifications ===== */` → before `/* ===== Footer ===== */` | `src/styles/notifications.css` |
| `/* ===== Footer ===== */` → before `/* ===== Accessibility ===== */` | `src/styles/footer.css` |
| `/* ===== Accessibility ===== */` → before `/* ===== Genre & Tag Tools ===== */` | `src/styles/accessibility.css` |
| `/* ===== Genre & Tag Tools ===== */` → before `/* ===== Manager Modal ===== */` | `src/styles/genre-tag-tools.css` |
| `/* ===== Manager Modal ===== */` → before `/* ===== Preview Modal ===== */` | `src/styles/manager-modal.css` |
| `/* ===== Preview Modal ===== */` → before `/* ===== Batch Tag Editor ===== */` | `src/styles/preview-modal.css` |
| `/* ===== Batch Tag Editor ===== */` → before `/* ===== Diff View ===== */` | `src/styles/batch-tag-editor.css` |
| `/* ===== Diff View ===== */` → before `/* ===== Help Guide ===== */` | `src/styles/diff-view.css` |
| `/* ===== Help Guide ===== */` → before `/* ===== Responsive: Tablet & Landscape Phone ===== */` | `src/styles/help-guide.css` |
| `/* ===== Responsive: Tablet & Landscape Phone ===== */` → before `/* ===== Responsive: Small Phone ===== */` | `src/styles/responsive-tablet-landscape-phone.css` |
| `/* ===== Responsive: Small Phone ===== */` → end of `<style>` block | `src/styles/responsive-small-phone.css` |

`src/styles/index.css` imports all partials in the exact order above to preserve cascade behavior.
