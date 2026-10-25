import { act, fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import { dynamic, ok, stubApi, type StubResponse } from "../../../../test/api-stub";
import { createTestRuntime, markerScreen, renderInApp } from "../../../../test/app-harness";
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

	it("shows the connection and the token's countdown, compact, in the page header", async () => {
		await renderSignedIn("/");
		const corner = within(screen.getByTestId("app-header"));

		expect(await corner.findByRole("button", { name: MEASURED_CONNECTION })).toBeOnTheScreen();
		expect(await corner.findByText("14m 32s")).toBeOnTheScreen();
		expect(corner.getByLabelText("Session verified, token expires in 14m 32s")).toBeOnTheScreen();
		// Compact: the connection is its bars and ping, without the strength's word.
		expect(corner.getByText("0 ms")).toBeOnTheScreen();
		expect(corner.queryByText("Strong, 0 ms")).toBeNull();
	});

	it("shows both in full in the app drawer", async () => {
		await renderSignedIn("/");
		await fireEvent.press(await screen.findByRole("button", { name: "Open menu" }));
		const status = within(screen.getByTestId("app-drawer-status"));

		expect(await status.findByText("Strong, 0 ms")).toBeOnTheScreen();
		expect(await status.findByText("Token expires in 14m 32s")).toBeOnTheScreen();
	});

	it("turns offline in both places when the connection drops", async () => {
		await renderSignedIn("/");
		await screen.findByText("14m 32s");

		await act(async (): Promise<void> => {
			setState(OFFLINE_STATE);
			await Promise.resolve();
		});

		expect(within(screen.getByTestId("app-header")).getByRole("button", { name: "Offline" })).toBeOnTheScreen();
		expect(within(screen.getByTestId("app-drawer-status", { includeHiddenElements: true })).getByText("Offline", { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it("ticks the countdown every second", async () => {
		await renderSignedIn("/");
		await screen.findByText("14m 32s");

		await act(async (): Promise<void> => {
			jest.advanceTimersByTime(2_000);
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(within(screen.getByTestId("app-header")).getByText("14m 30s")).toBeOnTheScreen();
		});
	});

	it("stays in the header deeper in a stack, beside the back button", async () => {
		await renderSignedIn("/");
		await fireEvent.press(await screen.findByRole("button", { name: "Open menu" }));
		await fireEvent.press(within(screen.getByTestId("app-drawer-panel")).getByRole("button", { name: "Security" }));
		expect(await screen.findByText("security screen")).toBeOnTheScreen();

		const header = within(screen.getByTestId("app-header"));
		expect(header.getByRole("button", { name: MEASURED_CONNECTION })).toBeOnTheScreen();
		expect(header.getByText("14m 32s")).toBeOnTheScreen();
		expect(header.getByRole("button", { name: "Back" })).toBeOnTheScreen();
	});
});
