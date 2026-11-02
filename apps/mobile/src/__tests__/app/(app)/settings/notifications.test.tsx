import type { DataValue } from "@workspace/shared";
import { act, fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import { fail, ok, okPage, stubApi } from "../../../../../test/api-stub";
import { createTestRuntime, renderInApp } from "../../../../../test/app-harness";
import { FAKE_DEVICE_TOKEN, permissionRequests, setNotificationPermission } from "../../../../../test/expo-notifications-fake";
import { testAccessToken } from "../../../../../test/jwt";
import NotificationSettingsScreen from "../../../../app/(app)/settings/notification-settings";
import NotificationsScreen from "../../../../app/(app)/settings/notifications";

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

const NOTICE_ID = "0193f2c4-0000-7000-8000-0000000000a1";
const BROADCAST_ID = "0193f2c4-0000-7000-8000-0000000000b1";
const TENANT_ID = "0193f2c4-0000-7000-8000-0000000000c1";
const CREATED_AT = 1_793_000_000_000;

function notice(overrides: Readonly<Record<string, DataValue>> = {}): DataValue {
	return {
		id: NOTICE_ID,
		typeKey: "broadcast",
		category: "MARKETING",
		surface: "CUSTOMER",
		title: "Weekend specials",
		body: "Half price lattes",
		richBody: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Half price lattes all Saturday" }] }] },
		link: null,
		icon: null,
		senderName: "Kopi & Co",
		senderLogoUrl: null,
		groupCount: 1,
		broadcastId: BROADCAST_ID,
		readAt: null,
		archivedAt: null,
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
		isDeleted: false,
		deletedAt: null,
		...overrides,
	};
}

const PREFERENCES = {
	tenantId: null,
	categories: [
		{
			category: "SECURITY",
			channels: [{ channel: "IN_APP", enabled: true, locked: true, available: true, reason: null }],
		},
		{
			category: "MARKETING",
			channels: [
				{ channel: "IN_APP", enabled: false, locked: false, available: true, reason: null },
				{ channel: "PUSH", enabled: false, locked: false, available: false, reason: "no-push-device" },
			],
		},
	],
	platformMarketingConsent: false,
	schedule: { quietHoursEnabled: false, quietStartMinute: 1320, quietEndMinute: 420, timeZone: "Asia/Kuala_Lumpur", digestFrequency: "OFF" },
	tenants: [{ tenantId: TENANT_ID, tenantName: "Kopi & Co", marketingConsent: true, left: false }],
};

async function renderSignedIn(screens: Parameters<typeof renderInApp>[1], url: string): Promise<void> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	await renderInApp(runtime, screens, url);
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const EARLIER_ID = "0193f2c4-0000-7000-8000-0000000000a2";
const INBOX = "GET /notifications";
const UNREAD_COUNT = "GET /notifications/unread-count";

/** A broadcast that arrived 25 minutes ago, unread, and a security notice from three days back, read. */
function feed(): DataValue[] {
	const now = Date.now();
	return [
		notice({ createdAt: now - 25 * MINUTE_MS, updatedAt: now - 25 * MINUTE_MS }),
		notice({
			id: EARLIER_ID,
			typeKey: "security.password-changed",
			category: "SECURITY",
			title: "Your password was changed",
			body: "If you didn't change it, reset your password now.",
			richBody: null,
			senderName: null,
			broadcastId: null,
			readAt: now - 3 * DAY_MS,
			createdAt: now - 3 * DAY_MS,
			updatedAt: now - 3 * DAY_MS,
		}),
	];
}

const INBOX_ROUTES = {
	[INBOX]: okPage(feed()),
	[UNREAD_COUNT]: ok({ unread: 1 }),
	"POST /notifications/read": ok({ ok: true }),
	"POST /notifications/archive": ok({ ok: true }),
	[`POST /broadcasts/${BROADCAST_ID}/report`]: ok({ ok: true }),
};

async function openInbox(): Promise<void> {
	await renderSignedIn({ "settings/notifications": NotificationsScreen, "settings/notification-settings": NotificationSettingsScreen }, "/settings/notifications");
	await screen.findByText("Weekend specials");
}

async function chooseFromMenu(title: string, action: string): Promise<void> {
	await fireEvent.press(screen.getByRole("button", { name: `More options for ${title}` }));
	await fireEvent.press(await screen.findByRole("menuitem", { name: action }));
}

describe("Notifications — the inbox", () => {
	it("lists the customer inbox as a feed: the last day under New, older ones under Earlier, unread ones marked", async () => {
		const api = stubApi(INBOX_ROUTES);
		await openInbox();

		expect(api.callsTo(INBOX).at(0)?.path).toContain("surface=CUSTOMER");
		expect(within(screen.getByTestId("notifications-section-new")).getByText("Weekend specials")).toBeOnTheScreen();
		expect(within(screen.getByTestId("notifications-section-earlier")).getByText("Your password was changed")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: /^Unread\. Weekend specials\. Half price lattes\. 25m$/u })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: /^Your password was changed\./u })).toBeOnTheScreen();
		expect(screen.getByText("3d")).toBeOnTheScreen();
	});

	it("reads a notice by opening it, and shows its full message", async () => {
		const api = stubApi(INBOX_ROUTES);
		await openInbox();

		await fireEvent.press(screen.getByRole("button", { name: /^Unread\. Weekend specials/u }));

		expect(await screen.findByText("Half price lattes all Saturday")).toBeOnTheScreen();
		await waitFor(() => {
			expect(api.callsTo("POST /notifications/read").at(0)?.body).toBe(JSON.stringify({ surface: "CUSTOMER", notificationIds: [NOTICE_ID] }));
		});
	});

	it("marks a notice read, reports a broadcast and removes a notice from its menu", async () => {
		const api = stubApi(INBOX_ROUTES);
		await openInbox();

		await chooseFromMenu("Weekend specials", "Mark as read");
		await waitFor(() => {
			expect(api.callsTo("POST /notifications/read").at(0)?.body).toBe(JSON.stringify({ surface: "CUSTOMER", notificationIds: [NOTICE_ID] }));
		});
		await chooseFromMenu("Weekend specials", "Report as spam");
		await waitFor(() => {
			expect(api.callsTo(`POST /broadcasts/${BROADCAST_ID}/report`).at(0)?.body).toBe(JSON.stringify({ reason: "SPAM", note: null }));
		});
		expect(await screen.findByText("Thanks. We'll look at it.")).toBeOnTheScreen();
		await chooseFromMenu("Your password was changed", "Remove this notification");

		await waitFor(() => {
			expect(api.callsTo("POST /notifications/archive").at(0)?.body).toBe(JSON.stringify({ notificationIds: [EARLIER_ID] }));
		});
		expect(await screen.findByText("Notification removed.")).toBeOnTheScreen();
	});

	it("offers a report only on a broadcast, and mark-as-read only while unread", async () => {
		stubApi(INBOX_ROUTES);
		await openInbox();

		await fireEvent.press(screen.getByRole("button", { name: "More options for Your password was changed" }));

		expect(await screen.findByRole("menuitem", { name: "Remove this notification" })).toBeOnTheScreen();
		expect(screen.queryByRole("menuitem", { name: "Report as spam" })).toBeNull();
		expect(screen.queryByRole("menuitem", { name: "Mark as read" })).toBeNull();
	});

	it("marks every notice read at once, and waits while none is unread", async () => {
		const api = stubApi(INBOX_ROUTES);
		await openInbox();

		await fireEvent.press(await screen.findByRole("button", { name: "Mark all as read" }));

		await waitFor(() => {
			expect(api.callsTo("POST /notifications/read").at(0)?.body).toBe(JSON.stringify({ surface: "CUSTOMER", markAll: true }));
		});
		stubApi({ ...INBOX_ROUTES, [UNREAD_COUNT]: ok({ unread: 0 }) });
		await openInbox();
		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
		});
	});

	it("lists only the unread on the Unread chip", async () => {
		const api = stubApi(INBOX_ROUTES);
		await openInbox();

		await fireEvent.press(screen.getByRole("radio", { name: "Unread" }));

		await waitFor(() => {
			expect(decodeURIComponent(api.callsTo(INBOX).at(-1)?.path ?? "")).toContain("filter[readAt][isNull]=true");
		});
		expect(screen.getByRole("radio", { name: "Unread" })).toBeChecked();
	});

	it("says so when nothing is unread", async () => {
		stubApi({ ...INBOX_ROUTES, [INBOX]: okPage([]) });
		await renderSignedIn({ "settings/notifications": NotificationsScreen }, "/settings/notifications");

		await fireEvent.press(await screen.findByRole("radio", { name: "Unread" }));

		expect(await screen.findByText("No unread notifications. You're all caught up.")).toBeOnTheScreen();
	});

	it("asks for a page more on See earlier notifications, and keeps the list while it loads", async () => {
		const api = stubApi({ ...INBOX_ROUTES, [INBOX]: okPage(feed(), { limit: 20, total: 30 }) });
		await openInbox();

		await fireEvent.press(screen.getByRole("button", { name: "See earlier notifications" }));

		await waitFor(() => {
			expect(api.callsTo(INBOX).at(-1)?.path).toContain("limit=40");
		});
		expect(screen.getByText("Weekend specials")).toBeOnTheScreen();
	});

	it("opens the notification settings from the feed", async () => {
		stubApi({ ...INBOX_ROUTES, "GET /notifications/preferences": ok(PREFERENCES) });
		await openInbox();

		await fireEvent.press(screen.getByRole("button", { name: "Notification settings" }));

		expect(await screen.findByText("What reaches you")).toBeOnTheScreen();
	});

	it("says when there is nothing", async () => {
		stubApi({ [INBOX]: okPage([]), [UNREAD_COUNT]: ok({ unread: 0 }) });
		await renderSignedIn({ "settings/notifications": NotificationsScreen }, "/settings/notifications");

		expect(await screen.findByText("You're all caught up.")).toBeOnTheScreen();
	});

	it("offers to try again when the inbox cannot be loaded", async () => {
		stubApi({ [INBOX]: fail(403, "FORBIDDEN", "Not yours"), [UNREAD_COUNT]: ok({ unread: 0 }) });
		await renderSignedIn({ "settings/notifications": NotificationsScreen }, "/settings/notifications");

		expect(await screen.findByText("Notifications could not be loaded.")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
	});
});

describe("Notifications — settings", () => {
	it("explains before asking for push, then registers this phone's token", async () => {
		const api = stubApi({
			"GET /notifications/preferences": ok(PREFERENCES),
			"PUT /notifications/push-devices": ok({
				id: "0193f2c4-0000-7000-8000-0000000000d1",
				platform: "ANDROID",
				surface: "CUSTOMER",
				deviceLabel: null,
				appVersion: null,
				lastSeenAt: CREATED_AT,
				isCurrentSession: true,
				createdAt: CREATED_AT,
				updatedAt: CREATED_AT,
				isDeleted: false,
				deletedAt: null,
			}),
		});
		await renderSignedIn({ "settings/notification-settings": NotificationSettingsScreen }, "/settings/notification-settings");

		expect(await screen.findByText("Get notified on this phone")).toBeOnTheScreen();
		expect(permissionRequests()).toBe(0);
		await fireEvent.press(screen.getByRole("button", { name: "Turn on notifications" }));

		expect(await screen.findByText("This phone gets notifications.")).toBeOnTheScreen();
		expect(permissionRequests()).toBe(1);
		expect(api.callsTo("PUT /notifications/push-devices").at(0)?.body).toContain(`"token":"${FAKE_DEVICE_TOKEN}"`);
	});

	it("points to the phone's settings once notifications were refused for good", async () => {
		setNotificationPermission("denied", false);
		stubApi({ "GET /notifications/preferences": ok(PREFERENCES) });
		await renderSignedIn({ "settings/notification-settings": NotificationSettingsScreen }, "/settings/notification-settings");

		expect(await screen.findByRole("button", { name: "Open Settings" })).toBeOnTheScreen();
	});

	it("shows each kind of message as a checkbox with its channels hung under it", async () => {
		stubApi({ "GET /notifications/preferences": ok(PREFERENCES) });
		await renderSignedIn({ "settings/notification-settings": NotificationSettingsScreen }, "/settings/notification-settings");

		const security = await screen.findByRole("checkbox", { name: "Security" });
		expect(security).toBeChecked();
		expect(security).toBeDisabled();
		const offers = screen.getByRole("checkbox", { name: "Offers" });
		expect(offers).not.toBeChecked();
		expect(offers).toBeEnabled();

		const kept = screen.getByTestId("notification-channel-SECURITY-IN_APP");
		expect(kept).toBeChecked();
		expect(kept).toBeDisabled();
		expect(screen.getByText("Always on, to keep your account safe")).toBeOnTheScreen();
		expect(screen.getByTestId("notification-channel-MARKETING-IN_APP")).not.toBeChecked();
		expect(screen.queryByTestId("notification-channel-SECURITY-EMAIL")).toBeNull();
		expect(screen.queryByRole("switch", { name: "In app" })).toBeNull();
	});

	it("saves one channel at a time", async () => {
		const api = stubApi({ "GET /notifications/preferences": ok(PREFERENCES), "PUT /notifications/preferences": ok(PREFERENCES) });
		await renderSignedIn({ "settings/notification-settings": NotificationSettingsScreen }, "/settings/notification-settings");

		await act(async (): Promise<void> => {
			await fireEvent.press(await screen.findByTestId("notification-channel-MARKETING-IN_APP"));
		});

		await waitFor(() => {
			expect(api.callsTo("PUT /notifications/preferences").at(0)?.body).toBe(
				JSON.stringify({ tenantId: null, changes: [{ category: "MARKETING", channel: "IN_APP", enabled: true }] }),
			);
		});
	});

	it("ticks every channel a kind can use at once, and leaves out the ones not available or kept on", async () => {
		const partly = {
			...PREFERENCES,
			categories: [
				...PREFERENCES.categories,
				{
					category: "ACCOUNT",
					channels: [
						{ channel: "IN_APP", enabled: true, locked: true, available: true, reason: null },
						{ channel: "EMAIL", enabled: true, locked: false, available: true, reason: null },
						{ channel: "PUSH", enabled: false, locked: false, available: true, reason: null },
					],
				},
			],
		};
		const api = stubApi({ "GET /notifications/preferences": ok(partly), "PUT /notifications/preferences": ok(partly) });
		await renderSignedIn({ "settings/notification-settings": NotificationSettingsScreen }, "/settings/notification-settings");

		const account = await screen.findByRole("checkbox", { name: "Account" });
		expect(account).toBePartiallyChecked();
		await act(async (): Promise<void> => {
			await fireEvent.press(account);
		});
		await waitFor(() => {
			expect(api.callsTo("PUT /notifications/preferences").at(0)?.body).toBe(
				JSON.stringify({ tenantId: null, changes: [{ category: "ACCOUNT", channel: "PUSH", enabled: true }] }),
			);
		});

		await act(async (): Promise<void> => {
			await fireEvent.press(screen.getByRole("checkbox", { name: "Offers" }));
		});
		await waitFor(() => {
			expect(api.callsTo("PUT /notifications/preferences").at(1)?.body).toBe(
				JSON.stringify({ tenantId: null, changes: [{ category: "MARKETING", channel: "IN_APP", enabled: true }] }),
			);
		});
	});

	it("says what to do for a channel that is not available yet, and hides one a kind is never sent on", async () => {
		const withHidden = {
			...PREFERENCES,
			categories: [
				...PREFERENCES.categories,
				{
					category: "PRODUCT",
					channels: [
						{ channel: "IN_APP", enabled: true, locked: false, available: true, reason: null },
						{ channel: "SMS", enabled: false, locked: false, available: false, reason: "not-offered" },
					],
				},
			],
		};
		stubApi({ "GET /notifications/preferences": ok(withHidden) });
		await renderSignedIn({ "settings/notification-settings": NotificationSettingsScreen }, "/settings/notification-settings");

		const push = await screen.findByTestId("notification-channel-MARKETING-PUSH");
		expect(push).toBeDisabled();
		expect(push).not.toBeChecked();
		expect(screen.getByText("Turn on notifications on this phone first")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Turn on" })).toBeOnTheScreen();

		expect(screen.getByRole("checkbox", { name: "Product news" })).toBeChecked();
		expect(screen.getByTestId("notification-channel-PRODUCT-IN_APP")).toBeChecked();
		expect(screen.queryByTestId("notification-channel-PRODUCT-SMS")).toBeNull();
	});

	it("asks before leaving a store, and only then leaves it", async () => {
		const api = stubApi({ "GET /notifications/preferences": ok(PREFERENCES), "POST /notifications/leave-tenant": ok({ ok: true }) });
		await renderSignedIn({ "settings/notification-settings": NotificationSettingsScreen }, "/settings/notification-settings");

		await fireEvent.press(await screen.findByRole("button", { name: "Leave store" }));

		expect(await screen.findByText("Leave Kopi & Co?")).toBeOnTheScreen();
		expect(api.callsTo("POST /notifications/leave-tenant")).toHaveLength(0);
	});

	it("shows a store you left as text, not as a switch", async () => {
		stubApi({ "GET /notifications/preferences": ok({ ...PREFERENCES, tenants: [{ tenantId: TENANT_ID, tenantName: "Kopi & Co", marketingConsent: false, left: true }] }) });
		await renderSignedIn({ "settings/notification-settings": NotificationSettingsScreen }, "/settings/notification-settings");

		expect(await screen.findByText("You left this store. Claim from it again to hear from it.")).toBeOnTheScreen();
		expect(screen.queryByRole("switch", { name: "Kopi & Co" })).toBeNull();
	});
});
