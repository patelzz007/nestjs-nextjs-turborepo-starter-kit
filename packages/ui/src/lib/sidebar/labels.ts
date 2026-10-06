/**
 * Copy interfaces of the sidebar label families (`sidebar`, `panelSidebarNav`
 * in `UiKitLabels`). The strings themselves live in the language packs
 * (`lib/labels/en.ts`, …); components read them with `useUiKitLabels`.
 */

/** User-visible copy for sidebar affordances: the toggle and the mobile sheet's title/description. */
export interface SidebarLabels {
	readonly toggleSidebar: string;
	readonly mobileTitle: string;
	readonly mobileDescription: string;
}

/**
 * Copy for a panel sidebar's navigation (search box, empty state, pinned
 * group, section reorder controls, unavailable items and the route
 * announcement) — the `panelSidebarNav` family.
 */
export interface PanelSidebarNavLabels {
	/** Accessible name of the main `<nav>` landmark (e.g. "Main navigation"). */
	readonly navigationAriaLabel: string;
	/** Accessible name of the footer `<nav>` (bottom items, e.g. "Account"). */
	readonly secondaryNavigationAriaLabel: string;
	readonly searchPlaceholder: string;
	readonly searchAriaLabel: string;
	readonly clearSearchAriaLabel: string;
	readonly noResultsTitle: string;
	readonly noResultsDescription: string;
	readonly pinnedSectionTitle: string;
	readonly moveSectionUpTitle: string;
	readonly moveSectionDownTitle: string;
	readonly moveSectionUpAriaLabel: (sectionTitle: string) => string;
	readonly moveSectionDownAriaLabel: (sectionTitle: string) => string;
	/** Tooltip and accessible description of an item the member cannot open right now. */
	readonly itemUnavailableTitle: string;
	/** Screen-reader announcement after navigating (e.g. `Navigated to ${pageLabel}`). */
	readonly routeAnnouncement: (pageLabel: string) => string;
}
