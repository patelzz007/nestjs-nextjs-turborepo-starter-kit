/** User-visible copy for sidebar affordances (rule 11 — parent supplies all strings). */
export interface SidebarLabels {
	readonly toggleSidebar: string;
	readonly mobileTitle: string;
	readonly mobileDescription: string;
}

export const DEFAULT_SIDEBAR_LABELS: SidebarLabels = {
	toggleSidebar: "Toggle sidebar",
	mobileTitle: "Sidebar",
	mobileDescription: "Displays the mobile sidebar.",
};
