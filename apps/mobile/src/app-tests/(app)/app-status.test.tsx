import { act, fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import { dynamic, ok, stubApi, type StubResponse } from "../../../test/api-stub";
import { createTestRuntime, markerScreen, renderInApp } from "../../../test/app-harness";
import { profileJson, sessionStatusJson, userJson } from "../../../test/fixtures";
import { testAccessToken } from "../../../test/jwt";
import { OFFLINE_STATE, setState } from "../../../test/network-fake";
import AppTabsLayout from "../../app/(app)/_layout";
import HomeScreen from "../../app/(app)/index";
// The whole module: the router reads `unstable_settings` (Settings first in its stack) from it, as in the app.
import * as SettingsLayoutModule from "../../app/(app)/settings/_layout";

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

describe("app status: connection and session (the admin topbar's indicators)", () => {
	beforeEach(() => {
		// The test router runs on Jest's fake clock (renderRouter installs it), so the expiry is read off that clock when the check arrives.
		stubApi({
			"GET /auth/me": ok(userJson()),
			"GET /auth/profile": ok(profileJson()),
			"GET /session": dynamic((): StubResponse => ok(sessionStatusJson(Date.now() + EXPIRES_IN_MS))),
		});
	});

	it("shows the connection and the token's countdown, compact, in the top-right corner of a tab's first screen", async () => {
		await renderSignedIn("/");
		const corner = within(screen.getByTestId("app-status-corner"));

		expect(corner.getByLabelText("Online")).toBeOnTheScreen();
		expect(await corner.findByText("14m 32s")).toBeOnTheScreen();
		expect(corner.getByLabelText("Session verified, token expires in 14m 32s")).toBeOnTheScreen();
		// Compact: the connection is an icon only.
		expect(corner.queryByText("Online")).toBeNull();
	});

	it("shows both in full in the app drawer", async () => {
		await renderSignedIn("/");
		await fireEvent.press(await screen.findByRole("button", { name: "Open menu" }));
		const status = within(screen.getByTestId("app-drawer-status"));

		expect(status.getByText("Online")).toBeOnTheScreen();
		expect(await status.findByText("Token expires in 14m 32s")).toBeOnTheScreen();
	});

	it("turns offline in both places when the connection drops", async () => {
		await renderSignedIn("/");
		await screen.findByText("14m 32s");

		await act(async (): Promise<void> => {
			setState(OFFLINE_STATE);
			await Promise.resolve();
		});

		expect(within(screen.getByTestId("app-status-corner")).getByLabelText("Offline")).toBeOnTheScreen();
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
			expect(within(screen.getByTestId("app-status-corner")).getByText("14m 30s")).toBeOnTheScreen();
		});
	});

	it("fades away deeper in a stack, where the corner belongs to the screen", async () => {
		await renderSignedIn("/");
		await fireEvent.press(await screen.findByRole("button", { name: "Open menu" }));
		await fireEvent.press(within(screen.getByTestId("app-drawer-panel")).getByRole("button", { name: "Security" }));
		expect(await screen.findByText("security screen")).toBeOnTheScreen();

		expect(screen.queryByTestId("app-status-corner")).toBeNull();
		expect(screen.getByTestId("app-status-corner", { includeHiddenElements: true })).toHaveProp("pointerEvents", "none");
	});
});
