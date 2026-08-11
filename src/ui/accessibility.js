const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

export const accessibilityUi = {
    activateModal(modal) {
        if (!modal) return;
        this._modalReturnFocus?.set(modal, document.activeElement);
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        (modal.querySelector(FOCUSABLE_SELECTOR) || modal).focus();
    },

    initializeAccessibility() {
        this._modalReturnFocus = new WeakMap();

        document.querySelectorAll('.modal').forEach((modal, index) => {
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-hidden', modal.classList.contains('active') ? 'false' : 'true');
            modal.tabIndex = -1;

            const title = modal.querySelector('.modal-title');
            if (title) {
                if (!title.id) title.id = `${modal.id || `dialog-${index}`}-title`;
                modal.setAttribute('aria-labelledby', title.id);
            }

            const observer = new MutationObserver(() => {
                const isOpen = modal.classList.contains('active');
                modal.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
                if (isOpen) {
                    setTimeout(() => {
                        const target = modal.querySelector(FOCUSABLE_SELECTOR) || modal;
                        target.focus();
                    }, 0);
                } else {
                    const returnTarget = this._modalReturnFocus.get(modal);
                    setTimeout(() => {
                        if (returnTarget?.isConnected && returnTarget.getClientRects().length > 0) {
                            returnTarget.focus();
                            return;
                        }
                        const fallback = document.querySelector(`[aria-controls="${modal.id}"]`) ||
                            document.getElementById('genreTagMenuTrigger');
                        if (fallback?.getClientRects().length > 0) fallback.focus();
                    }, 0);
                }
            });
            observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
        });

        const keyboardCards = [
            ['composerStatCard', event => this.toggleComposerStats(event)],
            ['modifiedStatCard', event => this.toggleModifiedStats(event)]
        ];
        keyboardCards.forEach(([id, activate]) => {
            const card = document.getElementById(id);
            if (!card) return;
            card.setAttribute('role', 'button');
            card.tabIndex = 0;
            card.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activate(event);
                }
            });
        });

        document.addEventListener('keydown', event => {
            const activeModal = [...document.querySelectorAll('.modal.active')].at(-1);
            if (!activeModal) return;

            if (event.key === 'Escape') {
                event.preventDefault();
                activeModal.classList.remove('active');
                return;
            }

            if (event.key !== 'Tab') return;
            const focusable = [...activeModal.querySelectorAll(FOCUSABLE_SELECTOR)]
                .filter(element => element.getClientRects().length > 0);
            if (focusable.length === 0) {
                event.preventDefault();
                activeModal.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable.at(-1);
            if (!activeModal.contains(document.activeElement)) {
                event.preventDefault();
                (event.shiftKey ? last : first).focus();
            } else if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    }
};
