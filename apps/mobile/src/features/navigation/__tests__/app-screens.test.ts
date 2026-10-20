import { ROUTES } from "../../../runtime/routes";
import { DEVICES_COPY } from "../../../contexts/identity";
import { screenTitleOf } from "../app-screens";

describe("screenTitleOf", () => {
	it("names the tabs as the tab bar does", () => {
		expect([ROUTES.home, ROUTES.analytics, ROUTES.search, ROUTES.profile, ROUTES.settings].map((route) => screenTitleOf(route, {}))).toEqual([
			"Home",
			"Analytics",
			"Search",
			"Profile",
			"Settings",
		]);
	});

	it("names the screens under Settings in their own words", () => {
		expect([ROUTES.security, ROUTES.devices, ROUTES.appearance, ROUTES.appLock].map((route) => screenTitleOf(route, {}))).toEqual([
			"Security",
			DEVICES_COPY.title,
			"Appearance",
			"App lock",
		]);
	});

	it("names the two-factor screen by its mode, turning it on by default or for an unknown mode", () => {
		expect(screenTitleOf(ROUTES.twoFactorSetup, { mode: "rotate" })).toBe("New backup codes");
		expect(screenTitleOf(ROUTES.twoFactorSetup, { mode: "setup" })).toBe("Turn on two-factor authentication");
		expect(screenTitleOf(ROUTES.twoFactorSetup, {})).toBe("Turn on two-factor authentication");
		expect(screenTitleOf(ROUTES.twoFactorSetup, { mode: ["rotate", "setup"] })).toBe("Turn on two-factor authentication");
	});

	it("names a GitHub commit by its short SHA, plainly when the link carries none", () => {
		const sha = "4f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39";

		expect(screenTitleOf(ROUTES.githubCommit, { owner: "octo-org", repository: "hello-world", sha })).toBe("Commit 4f2a9c1");
		expect(screenTitleOf(ROUTES.githubCommit, {})).toBe("Commit");
		expect(screenTitleOf(ROUTES.githubCommit, { sha: "not-a-sha" })).toBe("Commit");
		expect(screenTitleOf(ROUTES.githubCommit, { sha: [sha, sha] })).toBe("Commit");
	});

	it("names a pull request by its repository and number, plainly when the link carries none", () => {
		expect(screenTitleOf(ROUTES.pullRequest, { owner: "octo-org", repository: "hello-world", number: "42" })).toBe("hello-world #42");
		expect(screenTitleOf(ROUTES.pullRequest, {})).toBe("Pull request");
		expect(screenTitleOf(ROUTES.pullRequest, { repository: "hello-world", number: "zero" })).toBe("Pull request");
	});

	it("names a pull request's commit by its short SHA, like the Profile's commits", () => {
		const sha = "4f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39";

		expect(screenTitleOf(ROUTES.pullRequestCommit, { owner: "octo-org", repository: "hello-world", number: "42", sha })).toBe("Commit 4f2a9c1");
		expect(screenTitleOf(ROUTES.pullRequestCommit, {})).toBe("Commit");
	});

	it("titles the other GitHub pull-request screens", () => {
		expect([ROUTES.pullRequests, ROUTES.pullRequestFiles, ROUTES.pullRequestCommits, ROUTES.githubAccount].map((route) => screenTitleOf(route, {}))).toEqual([
			"Pull requests",
			"Files changed",
			"Commits",
			"GitHub token",
		]);
	});

	it("has no title for a path the app does not have", () => {
		expect(screenTitleOf("/nowhere", {})).toBe("");
	});
});
