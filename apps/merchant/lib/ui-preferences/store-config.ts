/**
 * localStorage key of the merchant display preferences (the rewards catalog's grid/list layout).
 * Unchanged from the older `merchant-rewards-view-mode` helper, so the saved layout carries over:
 * the bare `grid`/`list` string it wrote is upgraded by the feature's schema.
 */
export const MERCHANT_UI_PREFERENCES_STORAGE_KEY = "merchant-rewards-view-mode";

/** Redux DevTools instance name of the merchant display preferences store. */
export const MERCHANT_UI_PREFERENCES_DEVTOOLS_NAME = "UI Preferences · merchant";
