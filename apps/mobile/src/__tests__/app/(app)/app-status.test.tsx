import { act, fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import { dynamic, ok, stubApi, type StubResponse } from "../../../../test/api-stub";
import { createTestRuntime, markerScreen, renderInApp } from "../../../../test/app-harness";
import { openStreams, sendToStreams } from "../../../../test/expo-fetch-fake";
import { FAKE_DEVICE_TOKEN, permissionRequests, rotatePushToken, setNotificationPermission } from "../../../../test/expo-notifications-fake";
import { profileJson, sessionStatusJson, userJson } from "../../../../test/fixtures";
import { testAccessToken } from "../../../../test/jwt";
import { OFFLINE_STATE, setState } from "../../../../test/network-fake";
import AppTabsLayout from "../../../app/(app)/_layout";
import HomeScreen from "../../../app/(app)/index";
// The whole module: the router reads `unstable_settings` (Settings first in its stack) from it, as in the app.
import * as SettingsLayoutModule from "../../../app/(app)/settings/_layout";

/** The connection pill once the test has run: the test router's fake clock stands still, so every round trip is 0 ms. */
const MEASURED_CONNECTION = "Connection: strong, 0 ms ping";

/** The token the session check reports: 14 minutes 32 seconds left. */
const EXPIRES_IN_MS = 872_000;

const SCREENS = {
	"(app)/_layout": AppTabsLayout,
	"(app)/index": HomeScreen,
	"(app)/search": markerScreen("search screen"),
	"(app)/profile": markerScreen("profile screen"),
	"(app)/settings/_layout": SettingsLayoutModule,
	"(app)/settings/index": markerScreen("settings screen"),
	"(app)/settings/security": markerScreen("security screen"),
	"(app)/settings/devices": markerScreen("devices screen"),
	"(app)/settings/appearance": markerScreen("appearance screen"),
	"(app)/settings/app-lock": markerScreen("app-lock screen"),
};

async function renderSignedIn(url: string): Promise<void> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	await renderInApp(runtime, SCREENS, url);
}

describe("app status: connection and session (the web shells' indicators)", () => {
	beforeEach(() => {
		// The test router runs on Jest's fake clock (renderRouter installs it), so the expiry is read off that clock when the check arrives.
		stubApi({
			"GET /auth/me": ok(userJson()),
			"GET /auth/profile": ok(profileJson()),
			"GET /session": dynamic((): StubResponse => ok(sessionStatusJson(Date.now() + EXPIRES_IN_MS))),
			"GET /health/ping": ok({ timestamp: Date.now() }),
		});
	});

	it("keeps the page header free of status pills: no connection, no countdown (ADR 079)", async () => {
		await renderSignedIn("/");
		const header = within(screen.getByTestId("app-header"));

		expect(await header.findByRole("button", { name: "Open menu" })).toBeOnTheScreen();
		expect(header.queryByRole("button", { name: MEASURED_CONNECTION })).toBeNull();
		expect(header.queryByLabelText("Session verified, token expires in 14m 32s")).toBeNull();
	});

	it("shows both in full in the app drawer", async () => {
		await renderSignedIn("/");
		await fireEvent.press(await screen.findByRole("button", { name: "Open menu" }));
		const status = within(screen.getByTestId("app-drawer-status"));

		expect(await status.findByText("Strong, 0 ms")).toBeOnTheScreen();
		expect(await status.findByText("14m 32s left")).toBeOnTheScreen();
		expect(status.getByRole("button", { name: MEASURED_CONNECTION })).toBeOnTheScreen();
	});

	it("turns offline in the drawer when the connection drops", async () => {
		await renderSignedIn("/");
		await fireEvent.press(await screen.findByRole("button", { name: "Open menu" }));
		await within(screen.getByTestId("app-drawer-status")).findByText("14m 32s left");

		await act(async (): Promise<void> => {
			setState(OFFLINE_STATE);
			await Promise.resolve();
		});

		expect(within(screen.getByTestId("app-drawer-status", { includeHiddenElements: true })).getByText("Offline", { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it("ticks the drawer's countdown every second", async () => {
		await renderSignedIn("/");
		await fireEvent.press(await screen.findByRole("button", { name: "Open menu" }));
		const status = within(screen.getByTestId("app-drawer-status"));
		await status.findByText("14m 32s left");

		await act(async (): Promise<void> => {
			jest.advanceTimersByTime(2_000);
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(status.getByText("14m 30s left")).toBeOnTheScreen();
		});
	});

	it("keeps the header free of pills deeper in a stack too, beside the back button", async () => {
		await renderSignedIn("/");
		await fireEvent.press(await screen.findByRole("button", { name: "Open menu" }));
		const drawer = within(screen.getByTestId("app-drawer-panel"));
		// Security sits in the drawer's "Sign-in & security" branch (mobile-drawer-items.json).
		await fireEvent.press(drawer.getByRole("button", { name: "Sign-in & security" }));
		await fireEvent.press(drawer.getByRole("button", { name: "Security" }));
		expect(await screen.findByText("security screen")).toBeOnTheScreen();

		const header = within(screen.getByTestId("app-header"));
		expect(header.getByRole("button", { name: "Back" })).toBeOnTheScreen();
		expect(header.queryByRole("button", { name: MEASURED_CONNECTION })).toBeNull();
	});
});

describe("app status: the bell's unread count (ADR 070), live", () => {
	let unread = 2;

	beforeEach(() => {
		unread = 2;
		stubApi({
			"GET /auth/me": ok(userJson()),
			"GET /auth/profile": ok(profileJson()),
			"GET /session": dynamic((): StubResponse => ok(sessionStatusJson(Date.now() + EXPIRES_IN_MS))),
			"GET /health/ping": ok({ timestamp: Date.now() }),
			"GET /notifications/unread-count": dynamic((): StubResponse => ok({ unread })),
		});
	});

	it("shows the unread count on the bell, and holds the inbox's stream open with the session's token", async () => {
		await renderSignedIn("/");

		expect(await within(screen.getByTestId("app-header")).findByRole("button", { name: "Notifications, 2 unread" })).toBeOnTheScreen();
		expect(within(screen.getByTestId("app-header")).getByText("2", { includeHiddenElements: true })).toBeOnTheScreen();
		const [stream] = openStreams();
		expect(stream?.url).toContain("/notifications/stream?surface=CUSTOMER");
		expect(stream?.headers.Authorization).toMatch(/^Bearer /u);
	});

	it("moves the moment the stream says the inbox changed", async () => {
		await renderSignedIn("/");
		await within(screen.getByTestId("app-header")).findByRole("button", { name: "Notifications, 2 unread" });

		unread = 3;
		await act(async (): Promise<void> => {
			sendToStreams("/notifications/stream", JSON.stringify({ surface: "CUSTOMER", unread: 3 }));
			await Promise.resolve();
		});

		expect(await within(screen.getByTestId("app-header")).findByRole("button", { name: "Notifications, 3 unread" })).toBeOnTheScreen();
	});

	it("shows no count once everything is read", async () => {
		unread = 0;
		await renderSignedIn("/");

		await waitFor(() => {
			expect(within(screen.getByTestId("app-header")).getByRole("button", { name: "Notifications" })).toBeOnTheScreen();
		});
		expect(screen.queryByTestId("app-header-notification-count", { includeHiddenElements: true })).toBeNull();
	});
});

describe("app status: this phone stays registered for push (ADR 070)", () => {
	const DEVICE = {
		id: "0193f2c4-0000-7000-8000-0000000000d1",
		platform: "ANDROID",
		surface: "CUSTOMER",
		deviceLabel: null,
		appVersion: null,
		lastSeenAt: 1_793_000_000_000,
		isCurrentSession: true,
		createdAt: 1_793_000_000_000,
		updatedAt: 1_793_000_000_000,
		isDeleted: false,
		deletedAt: null,
	};

	function stubWithPush(): ReturnType<typeof stubApi> {
		return stubApi({
			"GET /auth/me": ok(userJson()),
			"GET /auth/profile": ok(profileJson()),
			"GET /session": dynamic((): StubResponse => ok(sessionStatusJson(Date.now() + EXPIRES_IN_MS))),
			"GET /health/ping": ok({ timestamp: Date.now() }),
			"PUT /notifications/push-devices": ok(DEVICE),
		});
	}

	it("registers an already-allowed phone again when the signed-in app starts, without asking", async () => {
		setNotificationPermission("granted");
		const api = stubWithPush();

		await renderSignedIn("/");

		await waitFor(() => {
			expect(api.callsTo("PUT /notifications/push-devices").at(0)?.body).toContain(`"token":"${FAKE_DEVICE_TOKEN}"`);
		});
		expect(permissionRequests()).toBe(0);
	});

	it("leaves a phone whose notifications are not allowed yet alone", async () => {
		const api = stubWithPush();

		await renderSignedIn("/");
		// The session has settled (its countdown is in the drawer) by the time registration would have run.
		await fireEvent.press(await screen.findByRole("button", { name: "Open menu" }));
		await within(screen.getByTestId("app-drawer-status")).findByText("14m 32s left");

		expect(api.callsTo("PUT /notifications/push-devices")).toHaveLength(0);
		expect(permissionRequests()).toBe(0);
	});

	it("registers the new token when the OS rotates it", async () => {
		setNotificationPermission("granted");
		const api = stubWithPush();
		await renderSignedIn("/");
		await waitFor(() => {
			expect(api.callsTo("PUT /notifications/push-devices")).toHaveLength(1);
		});

		await act(async (): Promise<void> => {
			rotatePushToken("fcm-token-rotated");
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(api.callsTo("PUT /notifications/push-devices").at(-1)?.body).toContain('"token":"fcm-token-rotated"');
		});
	});
});
