import { formatDataTableLabel } from "@workspace/ui/lib/data-table-labels";

/** Admin sidebar copy — parent/layout supplies strings (rule 11). */
export interface AdminSidebarLabels {
	readonly searchPlaceholder: string;
	readonly searchAriaLabel: string;
	readonly clearSearchAriaLabel: string;
	readonly noResultsTitle: string;
	readonly noResultsDescription: string;
	readonly logoutAriaLabel: string;
	readonly logoutTitle: string;
	readonly skipToContent: string;
	readonly itemUnavailableTitle: string;
	/** e.g. `Move {title} section up` */
	readonly moveSectionUpAriaLabel: string;
	/** e.g. `Move {title} section down` */
	readonly moveSectionDownAriaLabel: string;
	readonly moveSectionUpTitle: string;
	readonly moveSectionDownTitle: string;
}

export const ADMIN_SIDEBAR_LABELS: AdminSidebarLabels = {
	searchPlaceholder: "Search menu…",
	searchAriaLabel: "Search menu",
	clearSearchAriaLabel: "Clear search",
	noResultsTitle: "No menu items found",
	noResultsDescription: "Try a different search term",
	logoutAriaLabel: "Log out",
	logoutTitle: "Log out",
	skipToContent: "Skip to content",
	itemUnavailableTitle: "This feature is currently unavailable",
	moveSectionUpAriaLabel: "Move {title} section up",
	moveSectionDownAriaLabel: "Move {title} section down",
	moveSectionUpTitle: "Move section up (Alt+↑)",
	moveSectionDownTitle: "Move section down (Alt+↓)",
};

export function formatSidebarLabel(template: string, values: Readonly<Record<string, string>>): string {
	return formatDataTableLabel(template, values);
}
