/**
 * localStorage key of the web display preferences (the rewards catalog's grid/list layout).
 * Unchanged from the older `rewardhub-view-mode` helper, so the saved layout carries over:
 * the bare `grid`/`list` string it wrote is upgraded by the feature's schema.
 */
export const WEB_UI_PREFERENCES_STORAGE_KEY = "rewardhub-view-mode";

/** Redux DevTools instance name of the web display preferences store. */
export const WEB_UI_PREFERENCES_DEVTOOLS_NAME = "UI Preferences · web";
