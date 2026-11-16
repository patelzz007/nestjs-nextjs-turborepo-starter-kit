import { fireEvent, screen, within } from "expo-router/testing-library";

import { ok, stubApi } from "../../../../test/api-stub";
import { createTestRuntime, markerScreen, renderInApp } from "../../../../test/app-harness";
import { profileJson, userJson } from "../../../../test/fixtures";
import { testAccessToken } from "../../../../test/jwt";
import AppTabsLayout from "../../../app/(app)/_layout";
import HomeScreen from "../../../app/(app)/index";
// The whole modules: the router reads `unstable_settings` (the first screen of each stack) from them, as in the app.
import * as ProfileLayoutModule from "../../../app/(app)/profile/_layout";
import * as SettingsLayoutModule from "../../../app/(app)/settings/_layout";

const SCREENS = {
	"(app)/_layout": AppTabsLayout,
	"(app)/index": HomeScreen,
	"(app)/profile/_layout": ProfileLayoutModule,
	"(app)/profile/index": markerScreen("profile screen"),
	"(app)/profile/commit": markerScreen("commit screen"),
	"(app)/settings/_layout": SettingsLayoutModule,
	"(app)/settings/index": markerScreen("settings screen"),
	"(app)/settings/appearance": markerScreen("appearance screen"),
};

async function renderSignedIn(url: string): Promise<void> {
	stubApi({ "GET /auth/me": ok(userJson()), "GET /auth/profile": ok(profileJson()) });
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	await renderInApp(runtime, SCREENS, url);
}

describe("the header's breadcrumb (the web's trail, on the phone)", () => {
	it("shows no trail on a tab's first screen: one level would only repeat the title", async () => {
		await renderSignedIn("/");
		await screen.findByText("This is the starter shell");
		expect(screen.queryByTestId("app-breadcrumb")).toBeNull();
	});

	it("says where a drawer screen sits: its section and the branches above it", async () => {
		await renderSignedIn("/settings/appearance");
		await screen.findByText("appearance screen");
		const trail = within(await screen.findByTestId("app-breadcrumb"));
		expect(trail.getByText("Preferences")).toBeOnTheScreen();
		expect(trail.getByText("Display")).toBeOnTheScreen();
		expect(trail.getByText("Appearance")).toBeOnTheScreen();
		// A section or a branch is where the screen sits, not a screen to open.
		expect(trail.queryByRole("link")).toBeNull();
	});

	it("goes back up to a level above the screen", async () => {
		await renderSignedIn("/profile/commit");
		await screen.findByText("commit screen");
		const trail = within(await screen.findByTestId("app-breadcrumb"));

		await fireEvent.press(trail.getByRole("link", { name: "Profile" }));

		expect(await screen.findByText("profile screen")).toBeOnTheScreen();
		expect(screen).toHavePathname("/profile");
	});
});
