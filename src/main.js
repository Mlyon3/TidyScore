import { duplicateTools } from './tools/duplicate-tools.js';

/**
 * Merge extracted tool modules into the inline app object.
 *
 * index.html owns app creation and assigns the merged object to window.app
 * so existing inline handlers (onclick="app.method()") still resolve.
 */
export function mergeToolsIntoApp(app) {
    Object.assign(app, duplicateTools);
    return app;
}
