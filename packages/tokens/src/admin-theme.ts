// ============================================
// admin-theme.ts — the admin panel's own theme layer (2026-11-05, your call)
// ============================================
// The admin panel's dark theme is the phone app's graphite (GRAPHITE_DARK_THEME): the same object, so a change to
// one is a change to both. Its light and Nord themes stay the shared ones. render-web.ts writes these under
// `.dark .admin-app` in web.css; the web app and the merchant portal never see them.

import { GRAPHITE_DARK_THEME } from "./mobile-theme";
import type { AdminThemeOverrides } from "./schema";

export const ADMIN_THEME_OVERRIDES: AdminThemeOverrides = {
	dark: GRAPHITE_DARK_THEME,
};
