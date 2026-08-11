const ACTIONS = {
    openSettingsModal: app => app.openSettingsModal(),
    showHelp: app => app.showHelp(),
    toggleTheme: app => app.toggleTheme(),
    deleteSavedSession: app => app.deleteSavedSession(),
    restoreSavedSession: app => app.restoreSavedSession(),
    loadSample: app => app.loadSample(),
    toggleComposerStats: (app, event) => app.toggleComposerStats(event),
    toggleModifiedStats: (app, event) => app.toggleModifiedStats(event),
    runScanFix: (app, _event, element) => app.runScanFix(element.dataset.value),
    retryAnalysis: app => app.retryAnalysis(),
    openDuplicateModal: app => app.openDuplicateModal(),
    findReplace: app => app.findReplace(),
    toggleGenreTagMenu: (app, event) => app.toggleGenreTagMenu(event),
    suggestGenres: app => app.suggestGenres(),
    suggestTags: app => app.suggestTags(),
    openBatchTagEditor: app => app.openBatchTagEditor(),
    openManagerModal: app => app.openManagerModal(),
    clearSelection: app => app.clearSelection(),
    clearSearch: app => app.clearSearch(),
    mobileSortChanged: (app, _event, element) => app.mobileSortChanged(element.value),
    setSessionRecovery: (app, _event, element) => app.setSessionRecovery(element.checked),
    exportCSV: app => app.exportCSV(),
    undo: app => app.undo(),
    reset: app => app.reset(),
    closeModal: app => app.closeModal(),
    executeReplace: app => app.executeReplace(),
    toggleSelectAllExtractions: app => app.toggleSelectAllExtractions(),
    closeExtractionModal: app => app.closeExtractionModal(),
    applyExtraction: app => app.applyExtraction(),
    toggleImslpLabel: app => app.toggleImslpLabel(),
    toggleSelectAllImslp: app => app.toggleSelectAllImslp(),
    closeImslpModal: app => app.closeImslpModal(),
    applyImslpCleanup: app => app.applyImslpCleanup(),
    filterExportSummary: (app, _event, element) => app.filterExportSummary(element.value),
    clearExportSearch: app => app.clearExportSearch(),
    closeExportModal: app => app.closeExportModal(),
    downloadExport: app => app.downloadExport(),
    shareExport: app => app.shareExport(),
    closeExportCompleteModal: app => app.closeExportCompleteModal(),
    toggleAllPreviewItems: app => app.toggleAllPreviewItems(),
    closePreviewModal: app => app.closePreviewModal(),
    applyPreviewChanges: app => app.applyPreviewChanges(),
    switchBatchTagMode: (app, _event, element) => app.switchBatchTagMode(element.dataset.value),
    batchAddTag: (app, event) => {
        if (event.type !== 'keydown' || event.key === 'Enter') app.batchAddTag();
    },
    batchReplaceTag: app => app.batchReplaceTag(),
    closeBatchTagEditor: app => app.closeBatchTagEditor(),
    toggleAllGenreSuggestions: app => app.toggleAllGenreSuggestions(),
    closeGenreSuggestModal: app => app.closeGenreSuggestModal(),
    applyGenreSuggestions: app => app.applyGenreSuggestions(),
    toggleAllTagSuggestions: app => app.toggleAllTagSuggestions(),
    closeTagSuggestModal: app => app.closeTagSuggestModal(),
    applyTagSuggestions: app => app.applyTagSuggestions(),
    switchManagerTab: (app, _event, element) => app.switchManagerTab(element.dataset.value),
    filterManagerList: app => app.filterManagerList(),
    applyManagerRename: app => app.applyManagerRename(),
    closeManagerModal: app => app.closeManagerModal(),
    closeHelp: app => app.closeHelp(),
    addComposerAliasRow: app => app.addComposerAliasRow(),
    addComposerBlacklistRow: app => app.addComposerBlacklistRow(),
    resetComposerSettingsToDefaults: app => app.resetComposerSettingsToDefaults(),
    closeSettingsModal: app => app.closeSettingsModal(),
    saveSettingsFromModal: app => app.saveSettingsFromModal(),
    toggleDupSelectAll: app => app.toggleDupSelectAll(),
    closeDuplicateModal: app => app.closeDuplicateModal(),
    applyDuplicateTags: app => app.applyDuplicateTags(),
    previousPage: app => app.changePage(-1),
    nextPage: app => app.changePage(1)
};

export function bindUi(app, root = document) {
    root.querySelectorAll('[data-action]').forEach(element => {
        const action = ACTIONS[element.dataset.action];
        if (!action) throw new Error(`Unrecognized UI action: ${element.dataset.action}`);
        const eventName = element.dataset.event || 'click';
        element.addEventListener(eventName, event => {
            if (element.dataset.backdrop === 'true' && event.target !== element) return;
            if (element.tagName === 'A') event.preventDefault();
            action(app, event, element);
        });
    });

    const search = root.getElementById('searchInput');
    if (search) {
        search.addEventListener('input', event => {
            const value = event.target.value;
            root.getElementById('searchClear')?.classList.toggle('hidden', !value);
            clearTimeout(search._tidyScoreSearchTimer);
            search._tidyScoreSearchTimer = setTimeout(() => app.filterTable(value), 150);
        });
    }
}
