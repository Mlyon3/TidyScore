import app from './app/base.js';
import { csvCore } from './core/csv.js';
import { tableUi } from './ui/table.js';
import { modalUi } from './ui/modals.js';
import { composerTools } from './tools/composer-tools.js';
import { tagTools } from './tools/tag-tools.js';
import { duplicateTools } from './tools/duplicate-tools.js';

export function buildApp() {
    return Object.assign(app, csvCore, tableUi, modalUi, composerTools, tagTools, duplicateTools);
}

const composedApp = buildApp();

export default composedApp;
