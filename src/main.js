import app from './app/index.js';
import { csvCore } from './core/csv.js';
import { tableUi } from './ui/table.js';
import { modalUi } from './ui/modals.js';
import { duplicateTools } from './tools/duplicate-tools.js';

export function buildApp() {
    const globalApp = window.app || {};
    return Object.assign(globalApp, app, csvCore, tableUi, modalUi, duplicateTools);
}

const composedApp = buildApp();

window.app = composedApp;

export default composedApp;
