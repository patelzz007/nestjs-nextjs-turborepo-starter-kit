/** Every string of the super-admin impersonation panel. One object, so a locale is one more value of this type. */
export interface ImpersonateUserPanelLabels {
	readonly title: string;
	readonly description: string;
	readonly searchPlaceholder: string;
	readonly searchLabel: string;
	readonly loading: string;
	readonly empty: string;
	readonly impersonate: string;
	readonly previous: string;
	readonly next: string;
	/** The count between the page buttons. */
	readonly pageCount: (users: number) => string;
}

export const IMPERSONATE_USER_PANEL_LABELS: ImpersonateUserPanelLabels = {
	title: "Impersonate user",
	description: "Super-admin only. Switches your session in this app to the selected user.",
	searchPlaceholder: "Search by name or email…",
	searchLabel: "Search users",
	loading: "Loading users…",
	empty: "No users found.",
	impersonate: "Impersonate",
	previous: "Previous",
	next: "Next",
	pageCount: (users: number): string => `${String(users)} users`,
};
