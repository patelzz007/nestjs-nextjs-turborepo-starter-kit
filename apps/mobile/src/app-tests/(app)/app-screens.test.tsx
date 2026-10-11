import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import * as Haptics from "expo-haptics";
import * as React from "react";
import { DeviceEventEmitter, Linking, type KeyboardEvent } from "react-native";

// First: the uniwind mock factory below reads it while the screens import uniwind.
import * as mockUniwindDefaults from "../../../test/uniwind-mock";
import { dynamic, fail, ok, stubApi } from "../../../test/api-stub";
import { createTestRuntime, markerScreen, renderInApp } from "../../../test/app-harness";
import {
	githubCommitJson,
	githubCommitPageJson,
	githubContributorsJson,
	githubDiscoveredRepositoriesJson,
	githubRepositoriesJson,
	githubSummaryJson,
	profileJson,
	userJson,
} from "../../../test/fixtures";
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
		// The GitHub section is off (no repositories), so the only "Try again" is the profile's.
		stubApi({ "GET /auth/profile": fail(403, "FORBIDDEN", "No profile access"), "GET /github/repositories": ok(githubRepositoriesJson([])) });
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

describe("Profile — GitHub contributions", () => {
	const LIST = "GET /github/repositories";
	const SUMMARY = "GET /github/repositories/octo-org/hello-world";
	const CONTRIBUTORS = "GET /github/repositories/octo-org/hello-world/contributors";
	const NEWEST_COMMITS = "GET /github/repositories/octo-org/hello-world/commits?limit=10";
	const OLDER_COMMITS = "GET /github/repositories/octo-org/hello-world/commits?cursor=page-2&limit=10";

	/** Everything the section reads for octo-org/hello-world, plus the profile above it. */
	function helloWorldRoutes(): Record<string, ReturnType<typeof ok>> {
		return {
			"GET /auth/profile": ok(profileJson()),
			[LIST]: ok(githubRepositoriesJson()),
			[SUMMARY]: ok(githubSummaryJson()),
			[CONTRIBUTORS]: ok(githubContributorsJson(["octocat", "amy"])),
			[NEWEST_COMMITS]: ok(githubCommitPageJson([githubCommitJson({ index: 1, headline: "feat: add contributions" })])),
		};
	}

	it("shows the repository's numbers, languages, contributors and commits with their line counts", async () => {
		stubApi(helloWorldRoutes());
		await renderSignedIn({ profile: ProfileScreen }, "/profile");

		expect(await screen.findByText("GitHub contributions")).toBeOnTheScreen();
		expect(await screen.findByLabelText("Stars: 1,204")).toBeOnTheScreen();
		expect(screen.getByLabelText("Commits: 128")).toBeOnTheScreen();
		expect(screen.getByLabelText("TypeScript: 75%")).toBeOnTheScreen();
		expect(await screen.findByRole("link", { name: "octocat. 2 commits. 1,000 lines added, 250 deleted" })).toBeOnTheScreen();
		expect(await screen.findByRole("link", { name: /^feat: add contributions\. octocat · .* · 4 files\. 120 lines added, 30 deleted$/ })).toBeOnTheScreen();
		// One repository: nothing to choose.
		expect(screen.queryByRole("combobox", { name: /^Repository/ })).toBeNull();
	});

	it.each([
		["no repository is configured", ok(githubRepositoriesJson([]))],
		["the account may not read them (403)", fail(403, "FORBIDDEN", "Missing permission")],
	])("is not shown when %s", async (_label: string, answer: ReturnType<typeof ok>) => {
		const api = stubApi({ "GET /auth/profile": ok(profileJson()), [LIST]: answer });
		await renderSignedIn({ profile: ProfileScreen }, "/profile");

		expect(await screen.findByLabelText("Full name")).toBeOnTheScreen();
		await waitFor(() => {
			expect(api.callsTo(LIST)).toHaveLength(1);
		});
		expect(screen.queryByText("GitHub contributions")).toBeNull();
		expect(api.callsTo(SUMMARY)).toHaveLength(0);
	});

	it("holds the section's place with a skeleton while the repositories load", async () => {
		globalThis.fetch = jest.fn((): Promise<Response> => new Promise<Response>((): void => undefined));
		await renderSignedIn({ profile: ProfileScreen }, "/profile");

		expect(screen.getByRole("progressbar", { name: "Loading GitHub contributions" })).toBeBusy();
	});

	it("loads older commits with the cursor of the previous page", async () => {
		const api = stubApi({
			...helloWorldRoutes(),
			[NEWEST_COMMITS]: ok(githubCommitPageJson([githubCommitJson({ index: 1, headline: "Newest" })], "page-2")),
			[OLDER_COMMITS]: ok(githubCommitPageJson([githubCommitJson({ index: 2, headline: "Older" })])),
		});
		await renderSignedIn({ profile: ProfileScreen }, "/profile");

		await fireEvent.press(await screen.findByRole("button", { name: "Show older commits" }));

		expect(await screen.findByRole("link", { name: /^Older\./ })).toBeOnTheScreen();
		expect(screen.getByRole("link", { name: /^Newest\./ })).toBeOnTheScreen();
		expect(api.callsTo(OLDER_COMMITS)).toHaveLength(1);
		// The last page has no cursor: nothing older to offer.
		expect(screen.queryByRole("button", { name: "Show older commits" })).toBeNull();
	});

	it("switches between configured repositories", async () => {
		const api = stubApi({
			...helloWorldRoutes(),
			[LIST]: ok(githubRepositoriesJson(["octo-org/hello-world", "octo-org/website"])),
			"GET /github/repositories/octo-org/website": ok(githubSummaryJson("octo-org/website")),
			"GET /github/repositories/octo-org/website/contributors": ok(githubContributorsJson(["webdev"])),
			"GET /github/repositories/octo-org/website/commits?limit=10": ok(githubCommitPageJson([githubCommitJson({ index: 3, headline: "Website commit" })])),
		});
		await renderSignedIn({ profile: ProfileScreen }, "/profile");

		await fireEvent.press(await screen.findByRole("combobox", { name: "Repository, octo-org/hello-world" }));
		await fireEvent.press(screen.getByRole("radio", { name: "octo-org/website" }));

		expect(await screen.findByRole("link", { name: /^Website commit\./ })).toBeOnTheScreen();
		expect(screen.getByRole("combobox", { name: "Repository, octo-org/website" })).toBeOnTheScreen();
		expect(api.callsTo("GET /github/repositories/octo-org/website")).toHaveLength(1);
	});

	it("says so while GitHub is still counting contributors", async () => {
		stubApi({ ...helloWorldRoutes(), [CONTRIBUTORS]: ok({ status: "computing" }) });
		await renderSignedIn({ profile: ProfileScreen }, "/profile");

		expect(await screen.findByText("GitHub is still counting this repository's contributions. They'll appear here shortly.")).toBeOnTheScreen();
	});

	it("opens a commit on GitHub", async () => {
		const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
		stubApi(helloWorldRoutes());
		await renderSignedIn({ profile: ProfileScreen }, "/profile");

		await fireEvent.press(await screen.findByRole("link", { name: /^feat: add contributions\./ }));

		expect(openUrl).toHaveBeenCalledWith(`https://github.com/octo-org/hello-world/commit/${"1".padStart(40, "0")}`);
	});

	it("explains when GitHub cannot be opened", async () => {
		jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no browser"));
		stubApi(helloWorldRoutes());
		await renderSignedIn({ profile: ProfileScreen }, "/profile");

		await fireEvent.press(await screen.findByRole("link", { name: /^octocat\./ }));

		expect(await screen.findByText("Couldn't open GitHub. Try again from a browser.")).toBeOnTheScreen();
	});

	it("shows the API's message and retries a part that failed", async () => {
		let summaryReads = 0;
		stubApi({
			...helloWorldRoutes(),
			[SUMMARY]: dynamic(() => {
				summaryReads += 1;
				return summaryReads === 1 ? fail(404, "NOT_FOUND", "This GitHub repository could not be found on GitHub.") : ok(githubSummaryJson());
			}),
		});
		await renderSignedIn({ profile: ProfileScreen }, "/profile");

		expect(await screen.findByText("This GitHub repository could not be found on GitHub.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

		expect(await screen.findByLabelText("Stars: 1,204")).toBeOnTheScreen();
	});

	it("offers the account's own and contributed-to repositories in a searchable dropdown", async () => {
		const owned = ["patelzz007/one", "patelzz007/two", "patelzz007/three", "patelzz007/four", "patelzz007/five", "patelzz007/six", "patelzz007/seven", "patelzz007/eight"];
		stubApi({
			...helloWorldRoutes(),
			[LIST]: ok(githubDiscoveredRepositoriesJson("patelzz007", owned, ["vercel/next.js"])),
			"GET /github/repositories/patelzz007/one": ok(githubSummaryJson("patelzz007/one")),
			"GET /github/repositories/patelzz007/one/contributors": ok(githubContributorsJson()),
			"GET /github/repositories/patelzz007/one/commits?limit=10": ok(githubCommitPageJson([])),
			"GET /github/repositories/vercel/next.js": ok(githubSummaryJson("vercel/next.js")),
			"GET /github/repositories/vercel/next.js/contributors": ok(githubContributorsJson()),
			"GET /github/repositories/vercel/next.js/commits?limit=10": ok(githubCommitPageJson([githubCommitJson({ index: 9, headline: "Next.js commit" })])),
		});
		await renderSignedIn({ profile: ProfileScreen }, "/profile");

		expect(await screen.findByText("Public repositories of @patelzz007")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("combobox", { name: "Repository, patelzz007/one" }));

		expect(screen.getAllByRole("radio")).toHaveLength(9);
		expect(screen.getByRole("radio", { name: "patelzz007/one" })).toBeChecked();
		expect(screen.getAllByHintText(/^Your repository · pushed .+ ago$/)).toHaveLength(8);
		await fireEvent.changeText(screen.getByLabelText("Search repository"), "next");

		expect(screen.getAllByRole("radio")).toHaveLength(1);
		expect(screen.getByRole("radio", { name: "vercel/next.js" })).toBeOnTheScreen();
		expect(screen.getByHintText(/^Contributed to · pushed .+ ago$/)).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("radio", { name: "vercel/next.js" }));

		expect(await screen.findByRole("link", { name: /^Next\.js commit\./ })).toBeOnTheScreen();
	});
});
