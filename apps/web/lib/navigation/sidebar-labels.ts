/** Copy for the sidebar search, empty state, pinned section, and section reorder controls. */
interface SidebarLabels {
	readonly searchPlaceholder: string;
	readonly searchAriaLabel: string;
	readonly clearSearchAriaLabel: string;
	readonly noResultsTitle: string;
	readonly noResultsDescription: string;
	readonly pinnedSectionTitle: string;
	readonly moveSectionUpTitle: string;
	readonly moveSectionDownTitle: string;
	readonly moveSectionUpAriaLabel: (title: string) => string;
	readonly moveSectionDownAriaLabel: (title: string) => string;
}

export const WEB_SIDEBAR_LABELS: SidebarLabels = {
	searchPlaceholder: "Search menu…",
	searchAriaLabel: "Search sidebar menu",
	clearSearchAriaLabel: "Clear sidebar search",
	noResultsTitle: "No matching pages",
	noResultsDescription: "Try a different search term",
	pinnedSectionTitle: "Pinned",
	moveSectionUpTitle: "Move section up",
	moveSectionDownTitle: "Move section down",
	moveSectionUpAriaLabel: (title: string): string => `Move ${title} section up`,
	moveSectionDownAriaLabel: (title: string): string => `Move ${title} section down`,
};
