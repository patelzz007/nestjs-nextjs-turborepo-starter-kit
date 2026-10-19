/** Every string of the app-shell notifications dropdown. One object, so a locale is one more value of this type. */
export interface NotificationsDropdownLabels {
	readonly title: string;
	/** The trigger's accessible name; `unread` is 0 when everything is read. */
	readonly trigger: (unread: number) => string;
	/** The badge next to the title while some notifications are unread. */
	readonly unreadBadge: (unread: number) => string;
	readonly empty: string;
	readonly loadError: string;
	readonly viewAll: string;
}

export const NOTIFICATIONS_DROPDOWN_LABELS: NotificationsDropdownLabels = {
	title: "Notifications",
	trigger: (unread: number): string => (unread > 0 ? `Notifications, ${String(unread)} unread` : "Notifications"),
	unreadBadge: (unread: number): string => `${String(unread)} new`,
	empty: "You're all caught up.",
	loadError: "Notifications could not be loaded.",
	viewAll: "View all notifications",
};
