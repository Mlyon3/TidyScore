# Local Threat Model

TidyScore is a static, browser-only application. It does not operate a backend, upload CSV data, run telemetry, or send performance measurements.

## Trusted and untrusted data

- Treat every imported filename, header, and cell as untrusted text. Rendering must use text nodes or escaped markup.
- CSV parsing and worker analysis remain on-device. Workers receive only serializable row fields, settings, request IDs, and analysis budgets.
- Files and direct text imports are rejected above 25 MiB or 25,000 rows. Libraries above the validated 5,000-row target are allowed with a persistent warning.
- Import is atomic. Parse, validation, size, row-limit, and stale-read failures must not replace the open library or source filename.

## Exported formulas

Spreadsheet programs may interpret cells beginning with optional whitespace followed by `=`, `+`, `-`, or `@` as formulas. Export Review reports affected cell and row counts without displaying their contents. TidyScore preserves exact metadata instead of escaping or rewriting it; users should review those cells in the destination program.

## Browser boundary

The HTML meta Content Security Policy restricts scripts, module workers, images, manifests, and connections to the same origin; disables objects; and restricts base and form actions. `style-src 'unsafe-inline'` remains temporarily necessary for presentation-only inline styles. CSP reduces the impact of accidental injection but does not validate a CSV or protect data after it is opened in another application.

The generated Workbox service worker caches only the versioned application shell and same-origin runtime assets. Imported CSV contents are not network requests and are not added to service-worker caches. Navigation uses the network first when available and falls back to the precached application offline. A waiting update is user-visible and cannot reload while an active library is open.

## Local persistence and recovery

Theme and cleanup settings use local storage. Library recovery is opt-in and uses IndexedDB in the current browser profile. Session schema validation runs before restoration, internal row identities are reconstructed, and corrupt sessions can be deleted from the recovery prompt. Anyone with access to the browser profile may be able to inspect locally stored recovery data; disable recovery and delete the local copy on shared devices.

## Failure behavior

Worker responses are correlated by unique request ID and discarded after edits, settings changes, reset, or replacement import. A worker error leaves editing and export available and exposes a Retry action. Duplicate analysis stops at its candidate-pair budget and asks the user to filter or select fewer rows.
