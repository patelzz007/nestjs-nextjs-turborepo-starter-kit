import * as Clipboard from "expo-clipboard";
import { fireEvent, screen, waitFor, within } from "expo-router/testing-library";
import { Linking } from "react-native";

import { dynamic, fail, ok, stubApi } from "../../../test/api-stub";
import { createTestRuntime, type RenderedApp, renderInApp } from "../../../test/app-harness";
import {
	githubCommitDetailJson,
	githubCommitJson,
	githubCommitPageJson,
	githubContributorsJson,
	githubRepositoriesJson,
	githubSummaryJson,
	profileJson,
} from "../../../test/fixtures";
import { testAccessToken } from "../../../test/jwt";
import GithubCommitScreen, { INVALID_COMMIT_LINK_MESSAGE } from "../../app/(app)/profile/commit";
import ProfileScreen from "../../app/(app)/profile/index";
// The whole module: the router reads `unstable_settings` (the profile first in its stack) from it, as in the app.
import * as ProfileLayoutModule from "../../app/(app)/profile/_layout";
import { COMMIT_SHA_COPIED_MESSAGE } from "../../features/github/github-commit-detail";
import { MORE_FILES_ON_GITHUB } from "../../features/github/labels";

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

const SHA = "1".padStart(40, "0");
const PARENT_SHA = "f".repeat(40);
const PARENT_SHORT_SHA = PARENT_SHA.slice(0, 7);
const COMMIT_URL = `/profile/commit?owner=octo-org&repository=hello-world&sha=${SHA}`;
const COMMIT = `GET /github/repositories/octo-org/hello-world/commits/${SHA}`;

const PROFILE_SCREENS = {
	"profile/_layout": ProfileLayoutModule,
	"profile/index": ProfileScreen,
	"profile/commit": GithubCommitScreen,
};

async function renderSignedIn(url: string): Promise<RenderedApp> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	return renderInApp(runtime, PROFILE_SCREENS, url);
}

describe("A GitHub commit", () => {
	it("opens from the Profile's commit history", async () => {
		stubApi({
			"GET /auth/profile": ok(profileJson()),
			"GET /github/repositories": ok(githubRepositoriesJson()),
			"GET /github/repositories/octo-org/hello-world": ok(githubSummaryJson()),
			"GET /github/repositories/octo-org/hello-world/contributors": ok(githubContributorsJson()),
			"GET /github/repositories/octo-org/hello-world/commits?limit=10": ok(githubCommitPageJson([githubCommitJson({ index: 1, headline: "feat: add contributions" })])),
			[COMMIT]: ok(githubCommitDetailJson(1)),
		});
		const app = await renderSignedIn("/profile");

		await fireEvent.press(await screen.findByRole("link", { name: /^feat: add contributions\./ }));

		expect(await screen.findByRole("button", { name: /^src\/app\.ts\. Modified\./ })).toBeOnTheScreen();
		expect(app.pathnameWithParams()).toBe(COMMIT_URL);
	});

	it("shows the message, who committed it and when, its SHA and parent, like GitHub's commit page", async () => {
		stubApi({ [COMMIT]: ok(githubCommitDetailJson(1, { parents: [{ sha: PARENT_SHA, shortSha: PARENT_SHORT_SHA }] })) });
		await renderSignedIn(COMMIT_URL);

		expect(await screen.findByRole("header", { name: "feat: add contributions" })).toBeOnTheScreen();
		expect(screen.getByText("Shows each commit's changed files.")).toBeOnTheScreen();
		// The time is relative to the real clock here; labels.test.ts pins it.
		expect(screen.getByText(/^octocat committed .+ ago$/)).toBeOnTheScreen();
		expect(screen.getByLabelText("octocat's initials")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: `Commit ${SHA.slice(0, 7)}` })).toBeOnTheScreen();
		expect(screen.getByText("1 parent")).toBeOnTheScreen();
		expect(screen.getByText(PARENT_SHORT_SHA)).toBeOnTheScreen();
		expect(screen.getByText("Showing 3 changed files with 2 additions and 1 deletion.")).toBeOnTheScreen();
	});

	it("opens files with a short diff and draws each line of it", async () => {
		stubApi({ [COMMIT]: ok(githubCommitDetailJson(1)) });
		await renderSignedIn(COMMIT_URL);

		const file = await screen.findByRole("button", { name: "src/app.ts. Modified. 2 lines added, 1 deleted" });
		expect(file).toBeExpanded();
		expect(screen.getByLabelText("Deleted line 2: const b = 1;")).toBeOnTheScreen();
		expect(screen.getByLabelText("Added line 2: const b = 2;")).toBeOnTheScreen();
		expect(screen.getByLabelText("Added line 3: const c = 3;")).toBeOnTheScreen();

		await fireEvent.press(file);

		expect(screen.getByRole("button", { name: /^src\/app\.ts\./ })).toBeCollapsed();
		expect(screen.queryByLabelText("Deleted line 2: const b = 1;")).toBeNull();
	});

	it("explains a file with no text diff once opened", async () => {
		stubApi({ [COMMIT]: ok(githubCommitDetailJson(1)) });
		await renderSignedIn(COMMIT_URL);

		const renamed = await screen.findByRole("button", { name: "src/new-name.ts, from src/old-name.ts. Renamed. 0 lines added, 0 deleted" });
		expect(renamed).toBeCollapsed();
		await fireEvent.press(renamed);

		expect(screen.getByText("There's no text diff for this file. It may be binary, or only renamed.")).toBeOnTheScreen();
	});

	it("explains a diff too large to show", async () => {
		const tooLarge = { path: "dist/bundle.js", previousPath: null, status: "modified", additions: 9000, deletions: 8000, diff: { kind: "too-large" } };
		stubApi({ [COMMIT]: ok(githubCommitDetailJson(1, { files: [tooLarge] })) });
		await renderSignedIn(COMMIT_URL);

		await fireEvent.press(await screen.findByRole("button", { name: /^dist\/bundle\.js\./ }));

		expect(screen.getByText("This diff is too large to show here. Open the commit on GitHub to read it.")).toBeOnTheScreen();
	});

	it("says when the commit changed more files than shown", async () => {
		stubApi({ [COMMIT]: ok(githubCommitDetailJson(1, { filesTruncated: true, changedFiles: null })) });
		await renderSignedIn(COMMIT_URL);

		expect(await screen.findByText(MORE_FILES_ON_GITHUB)).toBeOnTheScreen();
	});

	it("says so when the commit changes no files", async () => {
		stubApi({ [COMMIT]: ok(githubCommitDetailJson(1, { files: [], changedFiles: 0, additions: 0, deletions: 0 })) });
		await renderSignedIn(COMMIT_URL);

		expect(await screen.findByText("This commit doesn't change any files.")).toBeOnTheScreen();
	});

	it("copies the full SHA and confirms it", async () => {
		stubApi({ [COMMIT]: ok(githubCommitDetailJson(1)) });
		await renderSignedIn(COMMIT_URL);

		await fireEvent.press(await screen.findByRole("button", { name: `Commit ${SHA.slice(0, 7)}` }));

		expect(Clipboard.setStringAsync).toHaveBeenCalledWith(SHA);
		expect(within(await screen.findByTestId("app-toast")).getByText(COMMIT_SHA_COPIED_MESSAGE)).toBeOnTheScreen();
	});

	it("opens the commit on GitHub, and explains when it cannot", async () => {
		const openUrl = jest.spyOn(Linking, "openURL").mockRejectedValueOnce(new Error("no browser")).mockResolvedValueOnce(true);
		stubApi({ [COMMIT]: ok(githubCommitDetailJson(1)) });
		await renderSignedIn(COMMIT_URL);

		await fireEvent.press(await screen.findByRole("button", { name: "View on GitHub" }));
		expect(await screen.findByText("Couldn't open GitHub. Try again from a browser.")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "View on GitHub" }));
		expect(openUrl).toHaveBeenLastCalledWith(`https://github.com/octo-org/hello-world/commit/${SHA}`);
		await waitFor(() => {
			expect(screen.queryByText("Couldn't open GitHub. Try again from a browser.")).toBeNull();
		});
	});

	it("shows the API's message and tries again", async () => {
		let reads = 0;
		stubApi({
			[COMMIT]: dynamic(() => {
				reads += 1;
				return reads === 1 ? fail(404, "NOT_FOUND", "This commit could not be found on GitHub.") : ok(githubCommitDetailJson(1));
			}),
		});
		await renderSignedIn(COMMIT_URL);

		expect(await screen.findByText("This commit could not be found on GitHub.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

		expect(await screen.findByRole("header", { name: "feat: add contributions" })).toBeOnTheScreen();
	});

	it("holds the commit's place with a skeleton while it loads", async () => {
		globalThis.fetch = jest.fn((): Promise<Response> => new Promise<Response>((): void => undefined));
		await renderSignedIn(COMMIT_URL);

		expect(screen.getByRole("progressbar", { name: "Loading the commit" })).toBeBusy();
	});

	it.each([
		["no SHA", "/profile/commit?owner=octo-org&repository=hello-world"],
		["a short SHA", "/profile/commit?owner=octo-org&repository=hello-world&sha=1a2b3c4"],
		["a malformed owner", `/profile/commit?owner=-octo&repository=hello-world&sha=${SHA}`],
	])("refuses a link with %s without asking the API", async (_label: string, url: string) => {
		const api = stubApi({});
		await renderSignedIn(url);

		expect(await screen.findByText(INVALID_COMMIT_LINK_MESSAGE)).toBeOnTheScreen();
		expect(api.callsTo(COMMIT)).toHaveLength(0);
	});
});
