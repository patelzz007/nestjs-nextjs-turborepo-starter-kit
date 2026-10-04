import type { PanelSidebarNavLabels } from "@workspace/ui/lib/sidebar/labels";

/** Admin sidebar copy — the shared panel nav labels plus the admin shell's own (rule 11: the parent supplies every string). */
export interface AdminSidebarLabels extends PanelSidebarNavLabels {
	readonly logoutAriaLabel: string;
	readonly logoutTitle: string;
	readonly skipToContent: string;
}

export const ADMIN_SIDEBAR_LABELS: AdminSidebarLabels = {
	navigationAriaLabel: "Main navigation",
	secondaryNavigationAriaLabel: "Account",
	searchPlaceholder: "Search menu…",
	searchAriaLabel: "Search menu",
	clearSearchAriaLabel: "Clear search",
	noResultsTitle: "No menu items found",
	noResultsDescription: "Try a different search term",
	pinnedSectionTitle: "Pinned",
	moveSectionUpTitle: "Move section up (Alt+↑)",
	moveSectionDownTitle: "Move section down (Alt+↓)",
	moveSectionUpAriaLabel: (sectionTitle: string): string => `Move ${sectionTitle} section up`,
	moveSectionDownAriaLabel: (sectionTitle: string): string => `Move ${sectionTitle} section down`,
	itemUnavailableTitle: "This feature is currently unavailable",
	routeAnnouncement: (pageLabel: string): string => `Navigated to ${pageLabel}`,
	logoutAriaLabel: "Log out",
	logoutTitle: "Log out",
	skipToContent: "Skip to content",
};
