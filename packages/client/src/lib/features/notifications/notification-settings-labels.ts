import type { NotificationCategory, NotificationChannel, NotificationChannelUnavailableReason, NotificationDigestFrequency, PushPlatform } from "@workspace/shared";

/** Every string of the notification settings page. One object, so a locale is one more value of this type. */
export interface NotificationSettingsLabels {
	readonly title: string;
	readonly description: string;
	readonly loadError: string;
	readonly saved: string;
	readonly saveFailed: string;
	readonly kindsTitle: string;
	readonly kindsDescription: string;
	readonly categories: Readonly<Record<NotificationCategory, { readonly title: string; readonly description: string }>>;
	readonly channels: Readonly<Record<NotificationChannel, string>>;
	/** Why a channel that is always on can't be turned off, per kind of message. */
	readonly locked: Readonly<Record<NotificationCategory, string>>;
	readonly unavailable: Readonly<Record<NotificationChannelUnavailableReason, string>>;
	readonly scheduleTitle: string;
	readonly scheduleDescription: string;
	readonly quietHours: string;
	readonly quietFrom: string;
	readonly quietUntil: string;
	readonly timeZone: (zone: string) => string;
	readonly useDeviceZone: (zone: string) => string;
	readonly digestLabel: string;
	readonly digest: Readonly<Record<NotificationDigestFrequency, string>>;
	readonly consentTitle: string;
	readonly consentDescription: string;
	readonly platformConsent: string;
	readonly noTenants: string;
	readonly tenantConsent: string;
	readonly leftTenant: string;
	readonly leave: string;
	readonly leaveTitle: (store: string) => string;
	readonly leaveDescription: string;
	readonly leaving: string;
	readonly devicesTitle: string;
	readonly devicesDescription: string;
	readonly noDevices: string;
	readonly thisDevice: string;
	readonly removeDevice: string;
	readonly deviceRemoved: string;
	readonly platforms: Readonly<Record<PushPlatform, string>>;
	readonly lastSeen: (epochMs: number) => string;
}

const LAST_SEEN_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const NOTIFICATION_SETTINGS_LABELS: NotificationSettingsLabels = {
	title: "Notification settings",
	description: "Choose what reaches you, and where. Security notices always come by email and in the app.",
	loadError: "Your settings could not be loaded. Try again in a moment.",
	saved: "Saved",
	saveFailed: "Not saved. Check your connection and try again.",
	kindsTitle: "What reaches you",
	kindsDescription: "Tick a kind to get all of it, or choose each way it reaches you.",
	categories: {
		SECURITY: { title: "Security", description: "Sign-ins, password and two-factor changes." },
		ACCOUNT: { title: "Account", description: "Your profile, team invitations and store changes." },
		TRANSACTIONAL: { title: "Activity", description: "Claims, redemptions, referrals and reviews." },
		PRODUCT: { title: "Product news", description: "New features and planned maintenance." },
		MARKETING: { title: "Offers", description: "Messages from the stores you have claimed from." },
		OPERATIONS: { title: "Operations", description: "Alerts when a server, instance or service needs attention. Always in the app and on your phone." },
	},
	channels: { IN_APP: "In app", EMAIL: "Email", PUSH: "Phone", SMS: "SMS" },
	locked: {
		SECURITY: "Always on, to keep your account safe",
		ACCOUNT: "Always on",
		TRANSACTIONAL: "Always on",
		PRODUCT: "Always on",
		MARKETING: "Always on",
		OPERATIONS: "Always on, so outages reach you at once",
	},
	unavailable: {
		mandatory: "Always on",
		"phone-unverified": "Add and verify your phone number first",
		"no-push-device": "Install the phone app and turn on notifications first",
		"not-offered": "Not sent this way",
		"needs-consent": "Turn on offers below first",
	},
	scheduleTitle: "Quiet hours and digest",
	scheduleDescription: "During quiet hours only security notices and operations alerts buzz your phone; everything else waits in the app.",
	quietHours: "Quiet hours",
	quietFrom: "From",
	quietUntil: "Until",
	timeZone: (zone: string): string => `Times are in ${zone}.`,
	useDeviceZone: (zone: string): string => `Use ${zone}`,
	digestLabel: "Bundle activity into a digest",
	digest: { OFF: "No digest — send each one", DAILY: "Once a day", WEEKLY: "Once a week" },
	consentTitle: "Offers",
	consentDescription: "Stores you claimed from can send you offers only while you agree. Stop any of them at any time.",
	platformConsent: "News and offers from us",
	noTenants: "You have not claimed from any store yet.",
	tenantConsent: "Offers from this store",
	leftTenant: "You left this store. Claim from it again to hear from it.",
	leave: "Leave store",
	leaveTitle: (store: string): string => `Leave ${store}?`,
	leaveDescription: "It stops sending you offers and messages until you claim one of its rewards again.",
	leaving: "Leaving…",
	devicesTitle: "Phones",
	devicesDescription: "Where phone notifications go. Remove a phone you no longer use.",
	noDevices: "No phone gets notifications yet. Install the app and allow notifications.",
	thisDevice: "This device",
	removeDevice: "Remove",
	deviceRemoved: "Phone removed",
	platforms: { IOS: "iPhone", ANDROID: "Android phone" },
	lastSeen: (epochMs: number): string => `Last seen ${LAST_SEEN_FORMAT.format(epochMs)}`,
};
