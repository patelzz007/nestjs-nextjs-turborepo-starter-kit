import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import * as Haptics from "expo-haptics";
import * as React from "react";
import { DeviceEventEmitter, type KeyboardEvent } from "react-native";

// First: the uniwind mock factory below reads it while the screens import uniwind.
import * as mockUniwindDefaults from "../../../test/uniwind-mock";
import { dynamic, fail, ok, stubApi } from "../../../test/api-stub";
import { createTestRuntime, markerScreen, renderInApp } from "../../../test/app-harness";
import { profileJson, userJson } from "../../../test/fixtures";
import { testAccessToken } from "../../../test/jwt";
import { memorySecureStore } from "../../../test/secure-store-memory";
import AppTabsLayout from "../../app/(app)/_layout";
import HomeScreen from "../../app/(app)/index";
import ProfileScreen from "../../app/(app)/profile";
import SearchScreen from "../../app/(app)/search";

const mockSetTheme = jest.fn();

/** What the OS sends when the keyboard moves. */
const KEYBOARD_EVENT: KeyboardEvent = {
	duration: 0,
	easing: "keyboard",
	endCoordinates: { height: 300, screenX: 0, screenY: 544, width: 390 },
	startCoordinates: { height: 0, screenX: 0, screenY: 844, width: 390 },
	isEventFromThisApp: true,
};

jest.mock("uniwind", () => ({
	...mockUniwindDefaults,
	Uniwind: {
		setTheme: (theme: string): void => {
			mockSetTheme(theme);
		},
	},
	useCSSVariable: (name: string): string => (name === "--primary" ? "#24364f" : "#ffffff"),
}));

async function renderSignedIn(screens: Readonly<Record<string, () => React.JSX.Element>>, url: string): Promise<ReturnType<typeof createTestRuntime>> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	await renderInApp(runtime, screens, url);
	return runtime;
}

describe("(app) tabs", () => {
	const TAB_SCREENS = {
		"(app)/_layout": AppTabsLayout,
		"(app)/index": HomeScreen,
		"(app)/search": SearchScreen,
		"(app)/profile": ProfileScreen,
		"(app)/settings": markerScreen("settings"),
	};

	function stubAccount(): void {
		stubApi({ "GET /auth/me": ok(userJson()), "GET /auth/profile": ok(profileJson()) });
	}

	it("offers Home, Search, Profile and Settings in the floating tab bar, Home selected", async () => {
		stubAccount();
		await renderSignedIn(TAB_SCREENS, "/");

		expect(await screen.findByText("Alex Morgan")).toBeOnTheScreen();
		const tabs = screen.getAllByRole("tab");
		expect(tabs).toHaveLength(4);
		const [home, search, profile, settings] = tabs;
		expect(home).toHaveAccessibleName("Home");
		expect(search).toHaveAccessibleName("Search");
		expect(profile).toHaveAccessibleName("Profile");
		expect(settings).toHaveAccessibleName("Settings");
		expect(screen.getByRole("tab", { name: "Home" })).toBeSelected();
		expect(mockSetTheme).not.toHaveBeenCalled();
	});

	it("switches tabs with a selection haptic, and none for the tab already open", async () => {
		const selection = jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
		stubAccount();
		await renderSignedIn(TAB_SCREENS, "/");
		await screen.findByText("Alex Morgan");

		await fireEvent.press(screen.getByRole("tab", { name: "Home" }));
		expect(selection).not.toHaveBeenCalled();

		await fireEvent.press(screen.getByRole("tab", { name: "Search" }));
		expect(await screen.findByText("Search is coming soon")).toBeOnTheScreen();
		expect(screen.getByRole("tab", { name: "Search" })).toBeSelected();
		expect(selection).toHaveBeenCalledTimes(1);
	});

	it("takes the Search page's button back to the Home tab", async () => {
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
		stubAccount();
		await renderSignedIn(TAB_SCREENS, "/search");

		expect(await screen.findByRole("header", { name: "Search is coming soon" })).toBeOnTheScreen();
		expect(screen.getByText("Soon you'll be able to find anything in the app from here.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Back to home" }));

		expect(await screen.findByText("Alex Morgan")).toBeOnTheScreen();
		expect(screen.getByRole("tab", { name: "Home" })).toBeSelected();
	});

	it("hides the tab bar while the keyboard is open", async () => {
		stubAccount();
		await renderSignedIn(TAB_SCREENS, "/");
		await screen.findByText("Alex Morgan");

		await act(async (): Promise<void> => {
			DeviceEventEmitter.emit("keyboardWillShow", KEYBOARD_EVENT);
			await Promise.resolve();
		});
		expect(screen.queryByTestId("app-tab-bar")).toBeNull();
		await act(async (): Promise<void> => {
			DeviceEventEmitter.emit("keyboardWillHide", KEYBOARD_EVENT);
			await Promise.resolve();
		});
		expect(screen.getByTestId("app-tab-bar")).toBeOnTheScreen();
	});

	it("keeps each tab's content clear of the floating bar", async () => {
		stubAccount();
		await renderSignedIn(TAB_SCREENS, "/");
		await screen.findByText("Alex Morgan");

		await fireEvent(screen.getByTestId("app-tab-bar"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 106 } } });

		expect(screen.getByTestId("tab-bar-clearance")).toHaveStyle({ height: 106 });
	});
});

describe("Home (§10.7)", () => {
	it("shows who is signed in", async () => {
		stubApi({ "GET /auth/me": ok(userJson()), "GET /auth/profile": ok(profileJson()) });
		await renderSignedIn({ index: HomeScreen }, "/");

		expect(await screen.findByText("Alex Morgan")).toBeOnTheScreen();
		expect(screen.getByText("member@example.com")).toBeOnTheScreen();
		expect(screen.getByLabelText("Alex Morgan's initials")).toHaveTextContent("AM");
		expect(screen.getByText("This is the starter shell")).toBeOnTheScreen();
	});

	it("holds the account card's place with a skeleton while the account loads — no spinner, no shift", async () => {
		globalThis.fetch = jest.fn((): Promise<Response> => new Promise<Response>((): void => undefined));
		await renderSignedIn({ index: HomeScreen }, "/");

		expect(screen.getByRole("progressbar", { name: "Loading your account" })).toBeBusy();
		expect(screen.queryByText("Loading your account…")).toBeNull();
	});

	it("replaces the skeleton with the account when it arrives", async () => {
		stubApi({ "GET /auth/me": ok(userJson()), "GET /auth/profile": ok(profileJson()) });
		await renderSignedIn({ index: HomeScreen }, "/");

		expect(await screen.findByText("Alex Morgan")).toBeOnTheScreen();
		expect(screen.queryByRole("progressbar", { name: "Loading your account" })).toBeNull();
	});

	it("warns when backup codes are running low", async () => {
		stubApi({
			"GET /auth/me": ok(userJson({ twoFactorEnabled: true })),
			"GET /auth/profile": ok(profileJson()),
			"GET /auth/2fa/backup-codes/remaining": ok({ remaining: 2 }),
		});
		await renderSignedIn({ index: HomeScreen }, "/");

		expect(await screen.findByText("Only 2 backup codes are left. Generate new ones in Security settings.")).toBeOnTheScreen();
	});

	it("shows an error with a retry when the account cannot be loaded", async () => {
		let attempts = 0;
		stubApi({
			"GET /auth/me": dynamic(() => {
				attempts += 1;
				return attempts === 1 ? fail(403, "FORBIDDEN", "Not allowed") : ok(userJson());
			}),
			"GET /auth/profile": ok(profileJson()),
		});
		await renderSignedIn({ index: HomeScreen }, "/");

		expect(await screen.findByText("Not allowed")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
		expect(await screen.findByText("Alex Morgan")).toBeOnTheScreen();
	});
});

describe("Profile (§10.8)", () => {
	it("holds the profile's place with a skeleton while it loads", async () => {
		globalThis.fetch = jest.fn((): Promise<Response> => new Promise<Response>((): void => undefined));
		await renderSignedIn({ profile: ProfileScreen }, "/profile");

		expect(screen.getByRole("progressbar", { name: "Loading your profile" })).toBeBusy();
		expect(screen.queryByLabelText("Full name")).toBeNull();
	});

	it("edits the full name with the optimistic-lock version, then shows the saved profile", async () => {
		const api = stubApi({
			"GET /auth/profile": ok(profileJson(3)),
			"PATCH /auth/profile": ok(profileJson(4, "Alex Q. Morgan")),
			"GET /auth/me": ok(userJson({ fullName: "Alex Q. Morgan" })),
		});
		await renderSignedIn({ profile: ProfileScreen }, "/profile");

		await fireEvent.changeText(await screen.findByLabelText("Full name"), "  Alex Q. Morgan ");
		await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));

		expect(await screen.findByText("Profile saved.")).toBeOnTheScreen();
		expect(api.callsTo("PATCH /auth/profile").at(0)?.body).toBe(JSON.stringify({ fullName: "Alex Q. Morgan", version: 3 }));
		expect(screen.getByLabelText("Full name")).toHaveDisplayValue("Alex Q. Morgan");
	});

	it("reloads after a stale version and asks to edit again", async () => {
		let reads = 0;
		stubApi({
			"GET /auth/profile": dynamic(() => {
				reads += 1;
				return ok(profileJson(reads === 1 ? 3 : 5, reads === 1 ? "Alex Morgan" : "Changed Elsewhere"));
			}),
			"PATCH /auth/profile": fail(409, "CONFLICT", "Stale version"),
		});
		await renderSignedIn({ profile: ProfileScreen }, "/profile");

		await fireEvent.changeText(await screen.findByLabelText("Full name"), "Alex M.");
		await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));

		await waitFor(() => {
			expect(screen.getByLabelText("Full name")).toHaveDisplayValue("Changed Elsewhere");
		});
	});

	it("validates with the shared schema", async () => {
		const api = stubApi({ "GET /auth/profile": ok(profileJson()) });
		await renderSignedIn({ profile: ProfileScreen }, "/profile");

		await fireEvent.changeText(await screen.findByLabelText("Full name"), "A");
		await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));

		expect(await screen.findByText("Full name must be at least 2 characters")).toBeOnTheScreen();
		expect(api.callsTo("PATCH /auth/profile")).toHaveLength(0);
	});

	it("shows a load error with a retry", async () => {
		stubApi({ "GET /auth/profile": fail(403, "FORBIDDEN", "No profile access") });
		await renderSignedIn({ profile: ProfileScreen }, "/profile");
		expect(await screen.findByText("No profile access")).toBeOnTheScreen();
		await act(async (): Promise<void> => {
			await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
		});
	});
});

describe("session end while signed in", () => {
	it("a revoked device leaves on its next request (ADR 034)", async () => {
		stubApi({ "GET /auth/me": fail(401, "SESSION_REVOKED", "This device was signed out"), "GET /auth/profile": ok(profileJson()) });
		const runtime = await renderSignedIn({ index: HomeScreen }, "/");

		await waitFor(() => {
			expect(runtime.sessionStore.getState()).toEqual({ status: "signedOut", reason: "sessionExpired" });
		});
		expect(memorySecureStore.peek("auth.refreshToken")).toBeNull();
	});
});
