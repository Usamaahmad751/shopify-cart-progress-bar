const gift_property = '_cart_progress_gift';

const Targets = [
    { section: 'cart-drawer', containerId: 'CartDrawer', selector: '.drawer__inner' },
    { section: 'cart-icon-bubble', containerId: 'cart-icon-bubble', selector: '.shopify-section' },
];

class CartProgressGift {
    constructor() {
        this.isSyncing = false;
        this.syncTimer = null;
        this.lastAddSignature = null;
        this.init();
    }

    init() {
        this.scheduleSync();

        if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
            subscribe(PUB_SUB_EVENTS.cartUpdate, () => this.scheduleSync());
        }
    }

    scheduleSync() {
        window.clearTimeout(this.syncTimer);
        this.syncTimer = window.setTimeout(() => this.sync(), 100);
    }

    getProgressElement() {
        return document.querySelector('[data-cart-progress]');
    }

    postCart(url, body) {
        return fetch(url, {
            ...fetchConfig(),
            body: JSON.stringify({
                ...body,
                sections: Targets.map((target) => target.section),
                sections_url: window.location.pathname,
            }),
        }).then((response) => response.json());
    }

    addGift(variantId) {
        return this.postCart(routes.cart_add_url, {
            items: [
                {
                    id: Number(variantId),
                    quantity: 1,
                    properties: { [gift_property]: 'true' },
                },
            ],
        });
    }

    setGiftQuantity(lineKey, quantity) {
        return this.postCart(routes.cart_change_url, { id: lineKey, quantity });
    }

    removeGiftLines(lineKeys) {
        const updates = {};
        lineKeys.forEach((key) => {
            updates[key] = 0;
        });
        return this.postCart(routes.cart_update_url, { updates });
    }

    renderSections(state) {
        if (!state.sections) return;

        Targets.forEach((target) => {
            const html = state.sections[target.section];
            if (!html) return;

            const container = document.getElementById(target.containerId);
            if (!container) return;

            const destination = container.querySelector(target.selector) || container;
            const parsed = new DOMParser().parseFromString(html, 'text/html');
            const source = parsed.querySelector(target.selector) || parsed.body;

            destination.innerHTML = source.innerHTML;
        });
    }

    sync() {
        if (this.isSyncing) return;

        const progress = this.getProgressElement();
        if (!progress) return;

        const giftVariantId = progress.dataset.giftVariantId;
        if (!giftVariantId) return;

        const giftThreshold = Number(progress.dataset.giftThreshold || 0);
        const cartTotal = Number(progress.dataset.cartTotal || 0);
        const giftLineKey = progress.dataset.giftLineKey;
        const giftLineKeys = (progress.dataset.giftLineKeys || '').split('||').filter(Boolean);
        const giftLineCount = Number(progress.dataset.giftLineCount || 0);
        const giftLineQuantity = Number(progress.dataset.giftLineQuantity || 0);
        const qualifies = cartTotal >= giftThreshold;
        const addSignature = `${giftVariantId}-${cartTotal}-${giftThreshold}`;

        let request;

        if (giftLineCount > 1) {

            request = this.removeGiftLines(giftLineKeys.slice(1));
        } else if (qualifies && !giftLineKey) {

            if (this.lastAddSignature === addSignature) return;
            this.lastAddSignature = addSignature;
            request = this.addGift(giftVariantId);

        } else if (!qualifies && giftLineKey) {
            this.lastAddSignature = null;
            request = this.setGiftQuantity(giftLineKey, 0);
        } else if (qualifies && giftLineKey && giftLineQuantity !== 1) {

            this.lastAddSignature = null;
            request = this.setGiftQuantity(giftLineKey, 1);

        } else {

            if (giftLineKey) this.lastAddSignature = null;
            return;

        }

        this.isSyncing = true;

        request
            .then((state) => {
                if (state.status) {
                    console.error(state.description || state.message);
                    return;
                }

                this.renderSections(state);
            })
            .catch((error) => console.error(error))
            .finally(() => {
                this.isSyncing = false;
            });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CartProgressGift();
});
