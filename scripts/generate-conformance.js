// Regenerates conformance/cases and conformance/data from the JavaScript domain layer.
// Run after any intentional behavior change: pnpm conformance

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conformanceFiles } from './conformance.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'conformance');

Object.entries(conformanceFiles()).forEach(([path, contents]) => {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
});
