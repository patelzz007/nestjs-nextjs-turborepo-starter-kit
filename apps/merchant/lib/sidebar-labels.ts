export const MERCHANT_SIDEBAR_LABELS = {
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
} as const;
