import type { PanelSidebarNavLabels } from "@workspace/ui/lib/sidebar/labels";

/** Copy for the merchant sidebar: landmarks, search, empty state, pinned section, reorder controls, route announcements. */
export const MERCHANT_SIDEBAR_LABELS: PanelSidebarNavLabels = {
	navigationAriaLabel: "Main navigation",
	secondaryNavigationAriaLabel: "Account",
	searchPlaceholder: "Search menu…",
	searchAriaLabel: "Search sidebar menu",
	clearSearchAriaLabel: "Clear sidebar search",
	noResultsTitle: "No matching pages",
	noResultsDescription: "Try a different search term",
	pinnedSectionTitle: "Pinned",
	moveSectionUpTitle: "Move section up (Alt+↑)",
	moveSectionDownTitle: "Move section down (Alt+↓)",
	moveSectionUpAriaLabel: (sectionTitle: string): string => `Move ${sectionTitle} section up`,
	moveSectionDownAriaLabel: (sectionTitle: string): string => `Move ${sectionTitle} section down`,
	itemUnavailableTitle: "This feature is currently unavailable",
	routeAnnouncement: (pageLabel: string): string => `Navigated to ${pageLabel}`,
};
