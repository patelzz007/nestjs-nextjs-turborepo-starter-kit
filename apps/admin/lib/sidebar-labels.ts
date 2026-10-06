import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";

/**
 * Admin's wording for the shared panel sidebar nav — only the strings that
 * differ from the kit pack's `panelSidebarNav` copy (the rest comes from the
 * `UiKitLanguageProvider` mounted in the root layout).
 */
export const ADMIN_PANEL_SIDEBAR_NAV_LABELS: UiKitLabelsOverride<"panelSidebarNav"> = {
	searchAriaLabel: "Search menu",
	clearSearchAriaLabel: "Clear search",
	noResultsTitle: "No menu items found",
};

/** Copy the admin shell renders itself (not a kit component), so the kit pack has no entry for it. */
export interface AdminShellLabels {
	/** Accessible name of the sidebar footer's log-out button. */
	readonly logoutAriaLabel: string;
	/** Tooltip of the sidebar footer's log-out button. */
	readonly logoutTitle: string;
	/** Text of the skip link that jumps past the sidebar to the main content. */
	readonly skipToContent: string;
}

export const ADMIN_SHELL_LABELS: AdminShellLabels = {
	logoutAriaLabel: "Log out",
	logoutTitle: "Log out",
	skipToContent: "Skip to content",
};
