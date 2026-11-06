// Copy of the app's notifications (ADR 070): the inbox, the push primer and the settings.

import type { BroadcastReportReason, NotificationCategory, NotificationChannel, NotificationChannelUnavailableReason, NotificationDigestFrequency } from "@workspace/shared";

import type { FeedSectionKey, InboxFilter } from "./feed-model";
import type { InboxOutOfDate } from "./inbox-state";

export const NOTIFICATIONS_TITLE = "Notifications";
export const NOTIFICATION_SETTINGS_TITLE = "Notification settings";

export const NOTIFICATIONS_COPY = {
	description: "Everything we've told you in this app.",
	filterLabel: "Show",
	filters: { all: "All", unread: "Unread" } satisfies Readonly<Record<InboxFilter, string>>,
	sections: { new: "New", earlier: "Earlier" } satisfies Readonly<Record<FeedSectionKey, string>>,
	empty: "You're all caught up.",
	emptyUnread: "No unread notifications. You're all caught up.",
	loadError: "Notifications could not be loaded.",
	offlineError: "You're offline. Your notifications will load when you're back online.",
	outOfDate: {
		offline: "You're offline. This list may be out of date.",
		refreshFailed: "Couldn't refresh. This list may be out of date.",
	} satisfies Readonly<Record<InboxOutOfDate, string>>,
	retry: "Try again",
	unread: "Unread",
	openHint: "Opens the full message",
	more: (title: string): string => `More options for ${title}`,
	menuTitle: "This notification",
	markRead: "Mark as read",
	markAllRead: "Mark all as read",
	remove: "Remove this notification",
	removed: "Notification removed.",
	reportAs: { SPAM: "Report as spam", OFFENSIVE: "Report as offensive", SCAM: "Report as a scam" } satisfies Readonly<Record<BroadcastReportReason, string>>,
	reported: "Thanks. We'll look at it.",
	settings: "Notification settings",
	seeEarlier: "See earlier notifications",
	openLink: "Open link",
	openAttachment: "Opens the attachment",
	attachmentDetail: (size: string): string => `PDF, ${size}`,
	attachmentDescription: (name: string): string => `Attached photo: ${name}`,
	copied: "Copied.",
};

export const PUSH_PRIMER_COPY = {
	title: "Get notified on this phone",
	description: "We'll tell you when a reward is claimed or redeemed and when something needs your attention. You choose what reaches you in Settings.",
	allow: "Turn on notifications",
	notNow: "Not now",
	blocked: "Notifications are off for this app. Turn them on in your phone's settings.",
	openSettings: "Open Settings",
	registered: "This phone gets notifications.",
	unavailable: "This build can't receive notifications yet.",
};

export const NOTIFICATION_SETTINGS_COPY = {
	description: "Choose what reaches you, and where. Security notices always reach you.",
	loadError: "Your settings could not be loaded.",
	saved: "Saved.",
	saveFailed: "Not saved. Check your connection and try again.",
	whatReachesYou: "What reaches you",
	whatReachesYouHint: "Tick a kind to get all of it, or choose each way it reaches you.",
	turnOnPush: "Turn on",
	quietAndDigest: "Quiet hours and digest",
	quietHours: "Quiet hours",
	quietHoursHint: (from: string, until: string, zone: string): string => `${from}–${until}, ${zone}. Only security notices and operations alerts buzz your phone.`,
	digest: "Bundle activity",
	offers: "Offers",
	offersHint: "Stores you claimed from can send you offers only while you agree.",
	platformConsent: "News and offers from us",
	tenantConsent: "Offers from this store",
	leftTenant: "You left this store. Claim from it again to hear from it.",
	leave: "Leave store",
	leaveTitle: (store: string): string => `Leave ${store}?`,
	leaveDescription: "It stops sending you offers and messages until you claim one of its rewards again.",
	cancel: "Cancel",
	noTenants: "You have not claimed from any store yet.",
};

export const CATEGORY_LABELS: Readonly<Record<NotificationCategory, string>> = {
	SECURITY: "Security",
	ACCOUNT: "Account",
	TRANSACTIONAL: "Activity",
	PRODUCT: "Product news",
	MARKETING: "Offers",
	OPERATIONS: "Operations",
};

/** What each kind of message is about, under its name in the settings. */
export const CATEGORY_DESCRIPTIONS: Readonly<Record<NotificationCategory, string>> = {
	SECURITY: "Sign-ins, password and two-factor changes.",
	ACCOUNT: "Your profile, team invitations and store changes.",
	TRANSACTIONAL: "Claims, redemptions, referrals and reviews.",
	PRODUCT: "New features and planned maintenance.",
	MARKETING: "Messages from the stores you have claimed from.",
	OPERATIONS: "A server, instance or service needs attention.",
};

export const CHANNEL_LABELS: Readonly<Record<NotificationChannel, string>> = { IN_APP: "In app", EMAIL: "Email", PUSH: "Phone", SMS: "SMS" };

/** What each channel is: the subtitle of an ordinary channel (every node of the settings tree has a title and a subtitle). */
export const CHANNEL_DESCRIPTIONS: Readonly<Record<NotificationChannel, string>> = {
	IN_APP: "In the bell, in every app you use",
	EMAIL: "To your sign-in email address",
	PUSH: "A notification on this phone",
	SMS: "A text to your verified phone number",
};

/** Why a channel that is always on can't be turned off, per kind of message. */
export const LOCKED_LABELS: Readonly<Record<NotificationCategory, string>> = {
	SECURITY: "Always on, to keep your account safe",
	ACCOUNT: "Always on",
	TRANSACTIONAL: "Always on",
	PRODUCT: "Always on",
	MARKETING: "Always on",
	OPERATIONS: "Always on, so outages reach you at once",
};

export const UNAVAILABLE_LABELS: Readonly<Record<NotificationChannelUnavailableReason, string>> = {
	mandatory: "Always on",
	"phone-unverified": "Add and verify your phone number first",
	"no-push-device": "Turn on notifications on this phone first",
	"not-offered": "Not sent this way",
	"needs-consent": "Turn on offers from us or a store below first",
};

export const DIGEST_LABELS: Readonly<Record<NotificationDigestFrequency, string>> = { OFF: "Off", DAILY: "Daily", WEEKLY: "Weekly" };
