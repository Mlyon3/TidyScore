import { afterEach, describe, expect, it, vi } from 'vitest';
import { pwaUi } from '../src/ui/pwa.js';

function makeApp({ hasLibrary }) {
    const prompt = {
        classList: {
            add: vi.fn(),
            remove: vi.fn()
        }
    };
    globalThis.document = {
        getElementById: vi.fn(() => prompt)
    };
    return {
        app: Object.assign({
            data: hasLibrary ? [{}] : [],
            showNotification: vi.fn(),
            _pwaUpdateCallback: null
        }, pwaUi),
        prompt
    };
}

afterEach(() => {
    delete globalThis.document;
});

describe('PWA update UI', () => {
    it('keeps a waiting update from reloading an active library', () => {
        const { app, prompt } = makeApp({ hasLibrary: true });
        const update = vi.fn();
        app.setPwaUpdateReady(update);

        expect(app.applyPwaUpdate()).toBe(false);
        expect(update).not.toHaveBeenCalled();
        expect(app.showNotification).toHaveBeenCalledWith(expect.stringContaining('Finish or export'));
        expect(prompt.classList.add).not.toHaveBeenCalledWith('hidden');
    });

    it('applies a user-approved update when no library is open', () => {
        const { app, prompt } = makeApp({ hasLibrary: false });
        const update = vi.fn();
        app.setPwaUpdateReady(update);

        expect(app.applyPwaUpdate()).toBe(true);
        expect(update).toHaveBeenCalledOnce();
        expect(app._pwaUpdateCallback).toBeNull();
        expect(prompt.classList.add).toHaveBeenCalledWith('hidden');
    });

    it('restores the prompt if update activation fails synchronously', () => {
        const { app, prompt } = makeApp({ hasLibrary: false });
        const update = vi.fn(() => { throw new Error('activation failed'); });
        app.setPwaUpdateReady(update);

        expect(app.applyPwaUpdate()).toBe(false);
        expect(app._pwaUpdateCallback).toBe(update);
        expect(prompt.classList.remove).toHaveBeenCalledWith('hidden');
        expect(app.showNotification).toHaveBeenCalledWith(expect.stringContaining('could not be applied'));
    });
});
