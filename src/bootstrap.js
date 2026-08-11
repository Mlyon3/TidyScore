import app from './main.js';
import { bindUi } from './ui/bindings.js';

function start() {
    bindUi(app);
    app.init();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
    start();
}
