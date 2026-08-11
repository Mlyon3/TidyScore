import app from './main.js';
import { bindUi } from './ui/bindings.js';
import { initializePwa } from './pwa.js';

function start() {
    bindUi(app);
    app.init();
    initializePwa(app);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
    start();
}
