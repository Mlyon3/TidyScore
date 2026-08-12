export const pwaUi = {
    setPwaUpdateReady(updateCallback) {
        this._pwaUpdateCallback = updateCallback;
        document.getElementById('pwaUpdatePrompt')?.classList.remove('hidden');
    },

    dismissPwaUpdate() {
        document.getElementById('pwaUpdatePrompt')?.classList.add('hidden');
    },

    applyPwaUpdate() {
        if (!this._pwaUpdateCallback) return false;
        if (this.data.length > 0) {
            this.showNotification('Finish or export the open library first. The update will remain ready for your next visit.');
            return false;
        }

        const update = this._pwaUpdateCallback;
        this._pwaUpdateCallback = null;
        this.dismissPwaUpdate();
        const restoreWaitingUpdate = () => {
            this._pwaUpdateCallback = update;
            document.getElementById('pwaUpdatePrompt')?.classList.remove('hidden');
            this.showNotification('The update could not be applied yet. Your library is unchanged; try again later.');
        };
        try {
            const result = update();
            if (result && typeof result.catch === 'function') result.catch(restoreWaitingUpdate);
            return true;
        } catch (_) {
            restoreWaitingUpdate();
            return false;
        }
    }
};
