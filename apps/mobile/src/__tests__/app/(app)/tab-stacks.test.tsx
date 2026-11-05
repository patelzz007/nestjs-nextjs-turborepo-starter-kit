import { act, fireEvent, screen } from "expo-router/testing-library";

import { PAGE_CHANGE_MS } from "@workspace/ui-native/lib/motion";
import { ok, stubApi } from "../../../../test/api-stub";
import { createTestRuntime, markerScreen, renderInApp } from "../../../../test/app-harness";
import { profileJson, userJson } from "../../../../test/fixtures";
import { testAccessToken } from "../../../../test/jwt";
import AppTabsLayout from "../../../app/(app)/_layout";
import HomeScreen from "../../../app/(app)/index";
import * as SettingsLayoutModule from "../../../app/(app)/settings/_layout";
import * as ProfileLayoutModule from "../../../app/(app)/profile/_layout";

/** Past the switch away: the tab left behind is frozen by then (features/navigation/freeze-hidden-tab). */
const FROZEN_MS = PAGE_CHANGE_MS * 4;

const SCREENS = {
	"(app)/_layout": AppTabsLayout,
	"(app)/index": HomeScreen,
	"(app)/analytics": markerScreen("analytics screen"),
	"(app)/search": markerScreen("search screen"),
	"(app)/profile/_layout": ProfileLayoutModule,
	"(app)/profile/index": markerScreen("profile screen"),
	"(app)/settings/_layout": SettingsLayoutModule,
	"(app)/settings/index": markerScreen("settings screen"),
	"(app)/settings/appearance": markerScreen("appearance screen"),
	"(app)/settings/notifications": markerScreen("notifications screen"),
};

async function renderOnAppearance(): Promise<void> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	await renderInApp(runtime, SCREENS, "/settings/appearance");
	expect(await screen.findByText("appearance screen")).toBeOnTheScreen();
}

async function settle(): Promise<void> {
	await act(async (): Promise<void> => {
		await jest.advanceTimersByTimeAsync(FROZEN_MS);
	});
}

describe("a tab's own stack", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		stubApi({ "GET /auth/me": ok(userJson()), "GET /auth/profile": ok(profileJson()) });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("is back at its first screen when the tab is shown again, even after it was frozen out of sight", async () => {
		await renderOnAppearance();
		await fireEvent.press(screen.getByTestId("tab-index"));
		await settle();
		await fireEvent.press(screen.getByTestId("tab-settings"));
		await settle();
		expect(screen.getByText("settings screen")).toBeOnTheScreen();
		expect(screen.queryByText("appearance screen")).toBeNull();
	});

	it("goes back to its first screen when its tab is pressed again", async () => {
		await renderOnAppearance();
		await fireEvent.press(screen.getByTestId("tab-settings"));
		await settle();
		expect(screen.getByText("settings screen")).toBeOnTheScreen();
	});

	it("goes back to Settings when its tab is pressed on the notifications the header bell opened from another tab", async () => {
		const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
		await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
		await renderInApp(runtime, SCREENS, "/");
		await fireEvent.press(await screen.findByTestId("app-header-notifications"));
		await settle();
		expect(screen.getByText("notifications screen")).toBeOnTheScreen();
		await fireEvent.press(screen.getByTestId("tab-settings"));
		await settle();
		expect(screen.getByText("settings screen")).toBeOnTheScreen();
	});

	it("resets the stack left on a deeper screen and leaves single-screen tabs alone, with no unhandled POP_TO_TOP", async () => {
		const errors = jest.spyOn(console, "error");
		await renderOnAppearance();
		await fireEvent.press(screen.getByTestId("tab-analytics"));
		await settle();
		await fireEvent.press(screen.getByTestId("tab-search"));
		await settle();
		expect(screen.getByText("search screen")).toBeOnTheScreen();
		const logged = errors.mock.calls.flat().join("\n");
		errors.mockRestore();
		expect(logged).not.toContain("POP_TO_TOP");
	});
});
