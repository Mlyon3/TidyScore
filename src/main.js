import app from './app/index.js';
import { duplicateTools } from './tools/duplicate-tools.js';

export function buildApp() {
    return Object.assign(app, duplicateTools);
}

const composedApp = buildApp();

export default composedApp;
