import { act, fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import { fail, ok, stubApi } from "../../../test/api-stub";
import { createTestRuntime, markerScreen, renderInApp } from "../../../test/app-harness";
import { githubAccountLinkedJson, profileJson, userJson } from "../../../test/fixtures";
import { testAccessToken } from "../../../test/jwt";
import { memorySecureStore } from "../../../test/secure-store-memory";
import AppTabsLayout from "../../app/(app)/_layout";
import HomeScreen from "../../app/(app)/index";
import SearchScreen from "../../app/(app)/search";
// The whole module: the router reads `unstable_settings` (Settings first in its stack) from it, as in the app.
import * as SettingsLayoutModule from "../../app/(app)/settings/_layout";
import * as ProfileLayoutModule from "../../app/(app)/profile/_layout";

/** Long enough for a tab switch's transition to have run its course. */
const SWITCH_SETTLED_MS = 1000;

/** The real tabs and drawer, with Home and Search real and the rest as markers. */
const SCREENS = {
	"(app)/_layout": AppTabsLayout,
	"(app)/index": HomeScreen,
	"(app)/search": SearchScreen,
	"(app)/profile": markerScreen("profile screen"),
	"(app)/settings/_layout": SettingsLayoutModule,
	"(app)/settings/index": markerScreen("settings screen"),
	"(app)/settings/security": markerScreen("security screen"),
	"(app)/settings/devices": markerScreen("devices screen"),
	"(app)/settings/appearance": markerScreen("appearance screen"),
	"(app)/settings/app-lock": markerScreen("app-lock screen"),
};

async function renderSignedIn(url: string): Promise<ReturnType<typeof createTestRuntime>> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	await renderInApp(runtime, SCREENS, url);
	return runtime;
}

async function openDrawer(): Promise<ReturnType<typeof within>> {
	await fireEvent.press(await screen.findByRole("button", { name: "Open menu" }));
	return within(screen.getByTestId("app-drawer-panel"));
}

describe("app drawer (ADR 038)", () => {
	beforeEach(() => {
		stubApi({ "GET /auth/me": ok(userJson()), "GET /auth/profile": ok(profileJson()), "POST /auth/logout": ok({ message: "Logged out successfully" }, 201) });
	});

	it("opens from the menu button in the corner of a tab's first screen, with who is signed in", async () => {
		await renderSignedIn("/");
		await screen.findByText("This is the starter shell");
		expect(screen.queryByTestId("app-drawer-account")).toBeNull();

		const drawer = await openDrawer();

		expect(await drawer.findByText("member@example.com")).toBeOnTheScreen();
		expect(drawer.getByRole("header", { name: "Alex Morgan" })).toBeOnTheScreen();
		expect(drawer.getByRole("header", { name: "Account" })).toBeOnTheScreen();
		expect(drawer.getByRole("header", { name: "Preferences" })).toBeOnTheScreen();
		expect(drawer.getByText("Version 1.0.0")).toBeOnTheScreen();
		// While it is open, screen readers see only the drawer.
		expect(screen.queryByText("This is the starter shell")).toBeNull();
	});

	it("marks the screen on show as selected", async () => {
		await renderSignedIn("/");
		const drawer = await openDrawer();

		expect(drawer.getByRole("button", { name: "Home" })).toBeSelected();
		expect(drawer.getByRole("button", { name: "Search" })).not.toBeSelected();
	});

	it("switches to a tab and closes", async () => {
		await renderSignedIn("/");
		const drawer = await openDrawer();

		await fireEvent.press(drawer.getByRole("button", { name: "Search" }));

		expect(await screen.findByText("Search is coming soon")).toBeOnTheScreen();
		expect(screen.getByTestId("app-drawer-panel", { includeHiddenElements: true })).toHaveProp("pointerEvents", "none");
	});

	it.each([
		["Security", "security screen"],
		["Signed-in devices", "devices screen"],
		["Appearance, System", "appearance screen"],
		["App lock, Off", "app-lock screen"],
	])("opens %s from anywhere", async (item, target) => {
		await renderSignedIn("/search");
		const drawer = await openDrawer();

		await fireEvent.press(drawer.getByRole("button", { name: item }));

		expect(await screen.findByText(target)).toBeOnTheScreen();
	});

	it("opens the profile from the account header", async () => {
		await renderSignedIn("/");
		const drawer = await openDrawer();

		await fireEvent.press(await drawer.findByRole("button", { name: "Edit profile" }));

		expect(await screen.findByText("profile screen")).toBeOnTheScreen();
	});

	it("closes without moving when the current screen is chosen", async () => {
		await renderSignedIn("/");
		const drawer = await openDrawer();

		await fireEvent.press(drawer.getByRole("button", { name: "Home" }));

		expect(await screen.findByText("This is the starter shell")).toBeOnTheScreen();
	});

	it("closes from the scrim", async () => {
		await renderSignedIn("/");
		await openDrawer();

		await fireEvent.press(screen.getByTestId("app-drawer-scrim", { includeHiddenElements: true }));

		expect(await screen.findByText("This is the starter shell")).toBeOnTheScreen();
	});

	it("signs out after the same confirmation as Settings", async () => {
		const runtime = await renderSignedIn("/");
		const drawer = await openDrawer();

		await fireEvent.press(drawer.getByRole("button", { name: "Sign out" }));
		expect(screen.getByText("You'll need your password to sign in again on this device.")).toBeOnTheScreen();
		await fireEvent.press(screen.getAllByRole("button", { name: "Sign out" }).at(-1) ?? screen.getByRole("button", { name: "Cancel" }));

		await waitFor(() => {
			expect(runtime.sessionStore.getState()).toEqual({ status: "signedOut", reason: "signedOut" });
		});
		expect(memorySecureStore.peek("auth.accessToken")).toBeNull();
	});

	it("keeps Settings under a sub-screen opened from the drawer, and resets the tab when it is left", async () => {
		await renderSignedIn("/");
		const drawer = await openDrawer();
		await fireEvent.press(drawer.getByRole("button", { name: "Appearance, System" }));
		expect(await screen.findByText("appearance screen")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("tab", { name: "Home" }));
		expect(await screen.findByText("This is the starter shell")).toBeOnTheScreen();
		// The navigator resets the left tab once the switch's transition has run its course (fake timers here).
		await act(async (): Promise<void> => {
			jest.advanceTimersByTime(SWITCH_SETTLED_MS);
			await Promise.resolve();
		});
		await fireEvent.press(screen.getByRole("tab", { name: "Settings" }));
		expect(await screen.findByText("settings screen")).toBeOnTheScreen();
		expect(screen.queryByText("appearance screen")).toBeNull();
	});

	it("switches tabs with the tokens' cross-fade normally", async () => {
		await renderSignedIn("/");
		await screen.findByText("This is the starter shell");

		await fireEvent.press(screen.getByRole("tab", { name: "Search" }));

		expect(await screen.findByText("Search is coming soon")).toBeOnTheScreen();
		expect(screen.getByRole("tab", { name: "Search" })).toBeSelected();
	});

	it("leads with back instead of the menu deeper in a stack, and back returns to the tab's first screen", async () => {
		await renderSignedIn("/");
		const drawer = await openDrawer();
		await fireEvent.press(drawer.getByRole("button", { name: "Security" }));
		expect(await screen.findByText("security screen")).toBeOnTheScreen();

		const header = within(screen.getByTestId("app-header"));
		expect(header.getByRole("header", { name: "Security" })).toBeOnTheScreen();
		expect(header.queryByRole("button", { name: "Open menu" })).toBeNull();
		await fireEvent.press(header.getByRole("button", { name: "Back" }));

		expect(await screen.findByText("settings screen")).toBeOnTheScreen();
		expect(within(screen.getByTestId("app-header")).getByRole("header", { name: "Settings" })).toBeOnTheScreen();
		expect(within(screen.getByTestId("app-header")).getByRole("button", { name: "Open menu" })).toBeOnTheScreen();
	});

	it("titles the header with the page on show as tabs switch", async () => {
		await renderSignedIn("/");
		expect(within(screen.getByTestId("app-header")).getByRole("header", { name: "Home" })).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("tab", { name: "Profile" }));

		expect(await screen.findByText("profile screen")).toBeOnTheScreen();
		expect(within(screen.getByTestId("app-header")).getByRole("header", { name: "Profile" })).toBeOnTheScreen();
	});

	it("puts the menu button on every tab's first screen", async () => {
		await renderSignedIn("/search");

		expect(await screen.findByRole("button", { name: "Open menu" })).toBeOnTheScreen();
	});
});

describe("app drawer: GitHub pull requests (ADR 052)", () => {
	/** The Profile tab as a stack, so the drawer can push the pull-request screens onto it. */
	const GITHUB_SCREENS = {
		"(app)/_layout": AppTabsLayout,
		"(app)/index": HomeScreen,
		"(app)/search": SearchScreen,
		"(app)/settings/_layout": SettingsLayoutModule,
		"(app)/settings/index": markerScreen("settings screen"),
		"(app)/profile/_layout": ProfileLayoutModule,
		"(app)/profile/index": markerScreen("profile screen"),
		"(app)/profile/pull-requests": markerScreen("pull requests screen"),
		"(app)/profile/github-account": markerScreen("github token screen"),
	};

	async function renderWithGithub(): Promise<void> {
		const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
		await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
		await renderInApp(runtime, GITHUB_SCREENS, "/");
	}

	it("shows a GitHub section to someone the API lets use pull requests, with the token's state", async () => {
		stubApi({ "GET /auth/me": ok(userJson()), "GET /auth/profile": ok(profileJson()), "GET /github/account": ok(githubAccountLinkedJson()) });
		await renderWithGithub();

		const drawer = await openDrawer();

		expect(await drawer.findByRole("header", { name: "GitHub" })).toBeOnTheScreen();
		expect(drawer.getByRole("button", { name: "Pull requests" })).toBeOnTheScreen();
		expect(drawer.getByRole("button", { name: "GitHub token, Linked" })).toBeOnTheScreen();
	});

	it("opens the pull requests from the drawer", async () => {
		stubApi({ "GET /auth/me": ok(userJson()), "GET /auth/profile": ok(profileJson()), "GET /github/account": ok({ status: "unlinked" }) });
		await renderWithGithub();
		const drawer = await openDrawer();

		await fireEvent.press(await drawer.findByRole("button", { name: "Pull requests" }));

		expect(await screen.findByText("pull requests screen")).toBeOnTheScreen();
	});

	it.each([
		["the API refuses them (not an admin)", fail(403, "FORBIDDEN", "Forbidden")],
		["the server has pull requests off", ok({ status: "off" })],
	])("hides the GitHub section when %s", async (_case, account) => {
		stubApi({ "GET /auth/me": ok(userJson()), "GET /auth/profile": ok(profileJson()), "GET /github/account": account });
		await renderWithGithub();

		const drawer = await openDrawer();

		expect(await drawer.findByRole("header", { name: "Preferences" })).toBeOnTheScreen();
		await waitFor(() => {
			expect(drawer.queryByRole("header", { name: "GitHub" })).toBeNull();
		});
	});
});
