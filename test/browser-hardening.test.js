import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const indexUrl = new URL('../index.html', import.meta.url);

describe('browser hardening shell', () => {
    it('uses an external bootstrap, no inline handlers, and no global app bridge', () => {
        const html = readFileSync(indexUrl, 'utf8');
        expect(html).toContain('<script type="module" src="src/bootstrap.js"></script>');
        expect(html).not.toMatch(/\son(?:click|change|input|keydown|submit|toggle)=/i);
        expect(html).not.toContain('window.app');
    });

    it('declares the expected GitHub Pages CSP boundary', () => {
        const html = readFileSync(indexUrl, 'utf8');
        const csp = html.match(/Content-Security-Policy" content="([^"]+)/)?.[1] || '';
        expect(csp).toContain("script-src 'self'");
        expect(csp).toContain("worker-src 'self'");
        expect(csp).toContain("connect-src 'self'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("base-uri 'self'");
        expect(csp).toContain("form-action 'self'");
    });
});
