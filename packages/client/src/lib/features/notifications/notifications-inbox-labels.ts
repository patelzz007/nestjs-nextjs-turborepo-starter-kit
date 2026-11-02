import type { BroadcastReportReason, NotificationCategory } from "@workspace/shared";

import type { NotificationInboxKind, NotificationInboxView } from "./notifications-inbox-url-state";

/** Every string of the full notifications page. One object, so a locale is one more value of this type. */
export interface NotificationsInboxLabels {
	readonly title: string;
	readonly description: string;
	readonly views: Readonly<Record<NotificationInboxView, string>>;
	readonly markAllRead: string;
	/** The header link to this app's notification settings. */
	readonly settings: string;
	readonly markRead: string;
	readonly archive: string;
	readonly open: string;
	/** Each kind of message, on its row and in the kind filter. */
	readonly kinds: Readonly<Record<NotificationCategory, string>>;
	/** The kind filter: its name and its options. */
	readonly kindFilter: string;
	readonly kindOptions: Readonly<Record<NotificationInboxKind, string>>;
	/** Said with an unread row's dot. */
	readonly unread: string;
	/** "3 alike" — a group folded into one row. */
	readonly grouped: (count: number) => string;
	readonly empty: Readonly<Record<NotificationInboxView, string>>;
	/** The list is empty because of the kind filter. */
	readonly emptyKind: string;
	readonly loadError: string;
	readonly retry: string;
	/** The live stream's state, for the pill next to the title. */
	readonly live: string;
	readonly polling: string;
	/** A broadcast's full message, folded under its summary. */
	readonly readMore: string;
	readonly readLess: string;
	/** Reporting a broadcast to the platform (ADR 073). */
	readonly report: string;
	readonly reportTitle: string;
	readonly reportReasons: Readonly<Record<BroadcastReportReason, string>>;
	readonly reported: string;
}

export const NOTIFICATIONS_INBOX_LABELS: NotificationsInboxLabels = {
	title: "Notifications",
	description: "Everything we've told you in this app. Choose what reaches you, and where, in Settings.",
	views: { all: "Inbox", unread: "Unread", archived: "Archived" },
	markAllRead: "Mark all as read",
	settings: "Settings",
	markRead: "Mark as read",
	archive: "Archive",
	open: "Open",
	kinds: {
		SECURITY: "Security",
		ACCOUNT: "Account",
		TRANSACTIONAL: "Activity",
		PRODUCT: "Product news",
		MARKETING: "Offers",
		OPERATIONS: "Operations alert",
	},
	kindFilter: "Kind",
	kindOptions: {
		any: "Every kind",
		SECURITY: "Security",
		ACCOUNT: "Account",
		TRANSACTIONAL: "Activity",
		PRODUCT: "Product news",
		MARKETING: "Offers",
		OPERATIONS: "Operations alerts",
	},
	unread: "Unread",
	grouped: (count: number): string => `${String(count)} alike`,
	empty: { all: "You're all caught up.", unread: "Nothing unread.", archived: "Nothing archived yet." },
	emptyKind: "Nothing of this kind here.",
	loadError: "Notifications could not be loaded.",
	retry: "Try again",
	live: "Live",
	polling: "Updating every minute",
	readMore: "Read the full message",
	readLess: "Show less",
	report: "Report",
	reportTitle: "What's wrong with this message?",
	reportReasons: { SPAM: "It's spam", OFFENSIVE: "It's offensive", SCAM: "It looks like a scam" },
	reported: "Thanks. We'll look at it, and you won't get messages like it from this sender for now.",
};
