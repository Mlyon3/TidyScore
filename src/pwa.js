import { registerSW } from 'virtual:pwa-register';

export function initializePwa(app, register = registerSW) {
    let applyUpdate = null;
    applyUpdate = register({
        immediate: true,
        onNeedRefresh() {
            app.setPwaUpdateReady(() => applyUpdate(true));
        },
        onOfflineReady() {
            app.showNotification('TidyScore is ready to work offline.');
        },
        onRegisterError() {
            // Offline support is optional; the online editor remains fully usable.
        }
    });
    return applyUpdate;
}
