// The inbox feed's model (ADR 070): what each kind of notice looks like (its glyph and colour), and
// how the feed splits into "New" (the last day) and "Earlier". Pure, so the screen only lays it out.

import type { InAppNotificationResponse, NotificationCategory } from "@workspace/shared";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import type { NotificationRowTone } from "@workspace/ui-native/components/notification-row";
import MegaphoneIcon from "lucide-react-native/icons/megaphone";
import ShieldAlertIcon from "lucide-react-native/icons/shield-alert";
import SirenIcon from "lucide-react-native/icons/siren";
import SparklesIcon from "lucide-react-native/icons/sparkles";
import TicketIcon from "lucide-react-native/icons/ticket";
import UserRoundIcon from "lucide-react-native/icons/user-round";

/** Which notices the inbox lists. */
export type InboxFilter = "all" | "unread";

/** A notice's look: the glyph of its kind, in its kind's colour (the icon tiles' tones, rules/07). */
export interface NoticeKind {
	readonly icon: LucideIcon;
	readonly tone: NotificationRowTone;
}

const NOTICE_KINDS: Readonly<Record<NotificationCategory, NoticeKind>> = {
	SECURITY: { icon: ShieldAlertIcon, tone: "red" },
	ACCOUNT: { icon: UserRoundIcon, tone: "violet" },
	TRANSACTIONAL: { icon: TicketIcon, tone: "green" },
	PRODUCT: { icon: SparklesIcon, tone: "blue" },
	MARKETING: { icon: MegaphoneIcon, tone: "orange" },
	OPERATIONS: { icon: SirenIcon, tone: "yellow" },
};

export function noticeKindOf(notification: InAppNotificationResponse): NoticeKind {
	return NOTICE_KINDS[notification.category];
}

/** The look of a kind of message itself (its row in the settings). */
export function categoryKindOf(category: NotificationCategory): NoticeKind {
	return NOTICE_KINDS[category];
}

/** Who it is from, for its picture: the sender named on it (a store), or nobody (the app itself). */
export function noticeSenderOf(notification: InAppNotificationResponse): { readonly name: string; readonly imageUrl: string | null } | null {
	return notification.senderName === null ? null : { name: notification.senderName, imageUrl: notification.senderLogoUrl };
}

export function isUnread(notification: InAppNotificationResponse): boolean {
	return notification.readAt === null;
}

/** How long a notice counts as new. */
export const NEW_FOR_MS = 86_400_000;

export type FeedSectionKey = "new" | "earlier";

export interface FeedSection {
	readonly key: FeedSectionKey;
	readonly notifications: readonly InAppNotificationResponse[];
}

/** The feed in its sections, newest first, leaving out an empty one. */
export function feedSectionsOf(notifications: readonly InAppNotificationResponse[], nowMs: number): readonly FeedSection[] {
	const isNew = (notification: InAppNotificationResponse): boolean => nowMs - notification.createdAt < NEW_FOR_MS;
	const sections: readonly FeedSection[] = [
		{ key: "new", notifications: notifications.filter(isNew) },
		{ key: "earlier", notifications: notifications.filter((notification) => !isNew(notification)) },
	];
	return sections.filter((section: FeedSection): boolean => section.notifications.length > 0);
}

/** An https address with a host: React Native's URL has no `canParse`, so the shape is checked here. */
const HTTPS_LINK = /^https:\/\/[^\s/?#]+[^\s]*$/iu;

/** Where a notice's link leads on the phone: an https page opens in the browser; anything else (an app path of the web) stays put. */
export function externalLinkOf(notification: InAppNotificationResponse): string | null {
	const { link } = notification;
	return link !== null && HTTPS_LINK.test(link) ? link : null;
}
