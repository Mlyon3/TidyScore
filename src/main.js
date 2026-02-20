import { duplicateTools } from './tools/duplicate-tools.js';

/**
 * Attach extracted tools to the app object so existing inline handlers
 * (e.g. onclick="app.openDuplicateModal()") continue to resolve.
 */
export function mergeToolsIntoApp(app) {
    Object.assign(app, duplicateTools);
    return app;
}

if (typeof window !== 'undefined' && window.app) {
    Object.assign(window.app, duplicateTools);
}
