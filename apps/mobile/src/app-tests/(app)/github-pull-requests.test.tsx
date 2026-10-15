import { IDEMPOTENCY_KEY_HEADER, SetGithubReactionSchema } from "@workspace/shared";
import { fireEvent, screen, waitFor, within } from "expo-router/testing-library";
import { Linking } from "react-native";
import { z } from "zod";

import type { DataValue } from "@workspace/shared";

import { dynamic, fail, ok, stubApi, type StubResponse, type StubRoute } from "../../../test/api-stub";
import { createTestRuntime, type RenderedApp, renderInApp, TEST_API_URL } from "../../../test/app-harness";
import {
	githubAccountLinkedJson,
	githubCommentJson,
	githubCommitDetailJson,
	githubCommitJson,
	githubPullRequestDetailJson,
	githubPullRequestFilesJson,
	githubPullRequestJson,
	githubPullRequestPageJson,
	githubReviewThreadJson,
	githubPullRequestStatusJson,
	userJson,
} from "../../../test/fixtures";
import * as fileSystem from "../../../test/expo-file-system-fake";
import * as imagePicker from "../../../test/expo-image-picker-fake";
import { testAccessToken } from "../../../test/jwt";
import * as ProfileLayoutModule from "../../app/(app)/profile/_layout";
import GithubAccountRoute from "../../app/(app)/profile/github-account";
import ProfileScreen from "../../app/(app)/profile/index";
import PullRequestRoute from "../../app/(app)/profile/pull-request";
import PullRequestCommitRoute from "../../app/(app)/profile/pull-request-commit";
import PullRequestCommitsRoute from "../../app/(app)/profile/pull-request-commits";
import PullRequestFilesRoute from "../../app/(app)/profile/pull-request-files";
import PullRequestsRoute from "../../app/(app)/profile/pull-requests";
import { EDIT_HISTORY_TITLE } from "../../features/github-pull-requests/edit-history-sheet";
import { GITHUB_NEW_TOKEN_URL } from "../../features/github-pull-requests/github-account-screen";
import {
	COMMENT_POSTED_MESSAGE,
	INVALID_PULL_REQUEST_LINK_MESSAGE,
	NO_PULL_REQUESTS_MESSAGE,
	OWN_PULL_REQUEST_REVIEW_NOTE,
	REVIEW_SUBMITTED_MESSAGE,
	TOKEN_LINKED_MESSAGE,
	TOKEN_UNLINKED_MESSAGE,
} from "../../features/github-pull-requests/labels";
import { LIVE_UPDATES_ON_DETAIL } from "../../features/github-pull-requests/live-updates-row";
import type { StreamingFetch } from "../../lib/server-events";
import { MORE_THREADS_ON_GITHUB } from "../../features/github-pull-requests/pull-request-files-screen";

/** `expo/fetch` streams the live-updates SSE; each test drives the stream it opens (`openLiveStream`). */
const mockExpoFetch = jest.fn<ReturnType<StreamingFetch>, Parameters<StreamingFetch>>();
jest.mock("expo/fetch", () => ({ fetch: (url: string, init: Parameters<StreamingFetch>[1]): ReturnType<StreamingFetch> => mockExpoFetch(url, init) }));

const SCREENS = {
	"profile/_layout": ProfileLayoutModule,
	"profile/index": ProfileScreen,
	"profile/pull-requests": PullRequestsRoute,
	"profile/pull-request": PullRequestRoute,
	"profile/pull-request-files": PullRequestFilesRoute,
	"profile/pull-request-commits": PullRequestCommitsRoute,
	"profile/pull-request-commit": PullRequestCommitRoute,
	"profile/github-account": GithubAccountRoute,
};

const PULL = "/github/pull-requests/octo-org/hello-world/42";
const PULL_URL = "/profile/pull-request?owner=octo-org&repository=hello-world&number=42";
const LIST = "GET /github/pull-requests?filter=yours&state=open";
const VALID_TOKEN = "github_pat_11ABCDEFG0123456789_abcdefghijklmnop";
/** A pull request someone else opened, as the linked account sees it. */
const REVIEWER_VIEW_FOR_PICTURES = githubPullRequestDetailJson({ viewerDidAuthor: false });

async function renderSignedIn(url: string): Promise<RenderedApp> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	return renderInApp(runtime, SCREENS, url);
}

describe("GitHub pull requests: the list", () => {
	it("lists the pull requests in the linked account's repositories, each with its state, title, author and labels", async () => {
		stubApi({ [LIST]: ok(githubPullRequestPageJson([githubPullRequestJson(42, { title: "Add the login screen" }), githubPullRequestJson(7, { isDraft: true })])) });
		await renderSignedIn("/profile/pull-requests");

		const row = await screen.findByRole("button", { name: "Open pull request octo-org/hello-world #42: Add the login screen" });
		expect(within(row).getByText(/^#42 opened .+ ago by octocat$/)).toBeOnTheScreen();
		expect(within(row).getByLabelText("Label bug")).toBeOnTheScreen();
		expect(within(row).getByLabelText("2 comments")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Draft pull request octo-org/hello-world #7: Pull request 7" })).toBeOnTheScreen();
		expect(screen.getByText("2 pull requests")).toBeOnTheScreen();
	});

	it("reads the list again for another filter and state", async () => {
		const api = stubApi({
			[LIST]: ok(githubPullRequestPageJson([githubPullRequestJson(42)])),
			"GET /github/pull-requests?filter=reviewRequested&state=open": ok(githubPullRequestPageJson([])),
			"GET /github/pull-requests?filter=reviewRequested&state=closed": ok(githubPullRequestPageJson([githubPullRequestJson(9, { state: "merged" })])),
		});
		await renderSignedIn("/profile/pull-requests");
		await screen.findByRole("button", { name: /#42/ });

		await fireEvent.press(screen.getByRole("button", { name: "Filter: Your repositories" }));
		await fireEvent.press(await screen.findByRole("radio", { name: "Review requests" }));
		expect(await screen.findByText(NO_PULL_REQUESTS_MESSAGE)).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "State: Open" }));
		await fireEvent.press(await screen.findByRole("radio", { name: "Closed" }));
		expect(await screen.findByRole("button", { name: "Merged pull request octo-org/hello-world #9: Pull request 9" })).toBeOnTheScreen();
		expect(api.callsTo("GET /github/pull-requests?filter=reviewRequested&state=closed")).toHaveLength(1);
	});

	it("adds the next page under the first", async () => {
		stubApi({
			[LIST]: ok(githubPullRequestPageJson([githubPullRequestJson(42)], "cursor-2")),
			"GET /github/pull-requests?filter=yours&state=open&cursor=cursor-2": ok(githubPullRequestPageJson([githubPullRequestJson(7)])),
		});
		await renderSignedIn("/profile/pull-requests");
		await screen.findByRole("button", { name: /#42/ });

		await fireEvent.press(screen.getByRole("button", { name: "Load more" }));

		expect(await screen.findByRole("button", { name: /#7: Pull request 7$/ })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: /#42/ })).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
	});

	it("opens a pull request", async () => {
		stubApi({ [LIST]: ok(githubPullRequestPageJson([githubPullRequestJson(42)])), [`GET ${PULL}`]: ok(githubPullRequestDetailJson()) });
		const app = await renderSignedIn("/profile/pull-requests");

		await fireEvent.press(await screen.findByRole("button", { name: /#42/ }));

		expect(await screen.findByRole("header", { name: "Add the login screen" })).toBeOnTheScreen();
		expect(app.pathnameWithParams()).toBe(PULL_URL);
	});

	it("offers to link a token when none is linked, instead of a retry", async () => {
		stubApi({ [LIST]: fail(409, "GITHUB_ACCOUNT_NOT_LINKED", "Link your GitHub token first."), "GET /github/account": ok({ status: "unlinked" }) });
		await renderSignedIn("/profile/pull-requests");

		await fireEvent.press(await screen.findByRole("button", { name: "Link a token" }));

		expect(await screen.findByTestId("github-token-field")).toBeOnTheScreen();
	});
});

describe("GitHub pull requests: one pull request", () => {
	it("shows the header, the merge line, the description, labels, reviewers and the conversation, like GitHub's app", async () => {
		stubApi({ [`GET ${PULL}`]: ok(githubPullRequestDetailJson()) });
		await renderSignedIn(PULL_URL);

		expect(await screen.findByRole("header", { name: "Add the login screen" })).toBeOnTheScreen();
		expect(screen.getByText("octo-org/hello-world #42")).toBeOnTheScreen();
		expect(screen.getByLabelText("Open")).toBeOnTheScreen();
		expect(screen.getByText("Review required")).toBeOnTheScreen();
		expect(screen.getByText("octocat wants to merge 3 commits into main from feature/login")).toBeOnTheScreen();
		expect(screen.getByText("the login screen")).toBeOnTheScreen();
		expect(screen.getByLabelText("Label bug")).toBeOnTheScreen();
		expect(screen.getByLabelText("Review requested from monalisa")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Commits, 3" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Files changed, 2 files, 120 lines added, 30 deleted" })).toBeOnTheScreen();
		expect(screen.getByText("Looks good to me.")).toBeOnTheScreen();
		expect(screen.getByText(/added the bug label/)).toBeOnTheScreen();
	});

	it('shows a description\'s edit history from its "edited"', async () => {
		const api = stubApi({
			[`GET ${PULL}`]: ok(githubPullRequestDetailJson()),
			"GET /github/content-edits/PR_kwDOtest42": ok({
				edits: [
					{ editedAt: 1_791_500_000_000, editor: { login: "octocat", avatarUrl: null }, body: "Adds **the login screen**." },
					{ editedAt: 1_791_400_000_000, editor: { login: "octocat", avatarUrl: null }, body: "Adds a screen." },
				],
				totalCount: 2,
			}),
		});
		await renderSignedIn(PULL_URL);

		await fireEvent.press(await screen.findByRole("button", { name: "Edited: octocat's text" }));

		const sheet = within(await screen.findByTestId("edit-history-sheet"));
		expect(sheet.getByRole("header", { name: EDIT_HISTORY_TITLE })).toBeOnTheScreen();
		expect(await sheet.findByText("Adds a screen.")).toBeOnTheScreen();
		expect(sheet.getByText(/\(original\)$/)).toBeOnTheScreen();
		expect(api.callsTo("GET /github/content-edits/PR_kwDOtest42")).toHaveLength(1);
	});

	it("reads more of the conversation on request", async () => {
		stubApi({
			[`GET ${PULL}`]: ok(
				githubPullRequestDetailJson({ timeline: { items: [{ type: "comment", comment: githubCommentJson("IC_first", "First comment.") }], nextCursor: "timeline-2" } }),
			),
			[`GET ${PULL}/timeline?cursor=timeline-2`]: ok({ items: [{ type: "comment", comment: githubCommentJson("IC_second", "Second comment.") }], nextCursor: null }),
		});
		await renderSignedIn(PULL_URL);
		await screen.findByText("First comment.");

		await fireEvent.press(screen.getByRole("button", { name: "Load more" }));

		expect(await screen.findByText("Second comment.")).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
	});

	it("opens its commits", async () => {
		stubApi({
			[`GET ${PULL}`]: ok(githubPullRequestDetailJson()),
			[`GET ${PULL}/commits`]: ok({ items: [githubCommitJson({ index: 1, headline: "feat: login form" })], nextCursor: null, totalCount: 1 }),
		});
		const app = await renderSignedIn(PULL_URL);

		await fireEvent.press(await screen.findByRole("button", { name: "Commits, 3" }));

		expect(await screen.findByText("feat: login form")).toBeOnTheScreen();
		expect(app.pathnameWithParams()).toBe("/profile/pull-request-commits?owner=octo-org&repository=hello-world&number=42");
	});

	it("opens its changed files", async () => {
		stubApi({
			[`GET ${PULL}`]: ok(githubPullRequestDetailJson()),
			[`GET ${PULL}/files?page=1`]: ok(githubPullRequestFilesJson()),
			[`GET ${PULL}/review-threads`]: ok({ threads: [], truncated: false }),
		});
		const app = await renderSignedIn(PULL_URL);

		await fireEvent.press(await screen.findByRole("button", { name: "Files changed, 2 files, 120 lines added, 30 deleted" }));

		expect(await screen.findByRole("button", { name: /^src\/app\.ts\. Modified\./ })).toBeOnTheScreen();
		expect(app.pathnameWithParams()).toBe("/profile/pull-request-files?owner=octo-org&repository=hello-world&number=42");
	});

	it("colours the line counts of Files changed green and red, and draws View on GitHub like Comment", async () => {
		stubApi({ [`GET ${PULL}`]: ok(githubPullRequestDetailJson()) });
		await renderSignedIn(PULL_URL);

		const counts = within(await screen.findByTestId("pull-request-line-counts", { includeHiddenElements: true }));
		expect(counts.getByText("+120", { includeHiddenElements: true })).toHaveProp("className", expect.stringContaining("text-success-foreground"));
		expect(counts.getByText("−30", { includeHiddenElements: true })).toHaveProp("className", expect.stringContaining("text-destructive-foreground"));
		// The same colour as "Comment" (the primary action), as a compact pill in the header.
		expect(screen.getByRole("button", { name: "View on GitHub" })).toHaveProp("className", expect.stringContaining("bg-primary"));
		expect(screen.getByTestId("pull-request-comment-submit")).toHaveProp("className", expect.stringContaining("bg-primary"));
	});

	it("shows GitHub's merge box from GitHub: review, checks and conflicts, each in words", async () => {
		stubApi({
			[`GET ${PULL}`]: ok(githubPullRequestDetailJson()),
			[`GET ${PULL}/status`]: ok(githubPullRequestStatusJson()),
		});
		await renderSignedIn(PULL_URL);

		const box = within(await screen.findByTestId("pull-request-merge-box"));
		expect(await box.findByLabelText("All checks have passed. 3 successful, 1 skipped checks")).toBeOnTheScreen();
		expect(box.getByLabelText("No conflicts with base branch. Merging can be performed automatically.")).toBeOnTheScreen();
		expect(box.getByLabelText("Review required. At least one approving review is needed before merging.")).toBeOnTheScreen();
		// Tinted like the app's toasts: a soft fill and a slightly darker border of the row's tone.
		expect(box.getByLabelText("All checks have passed. 3 successful, 1 skipped checks")).toHaveProp(
			"className",
			expect.stringContaining("border-tone-green/30 bg-tone-green-soft"),
		);
		expect(box.getByLabelText("Review required. At least one approving review is needed before merging.")).toHaveProp(
			"className",
			expect.stringContaining("bg-tone-yellow-soft"),
		);
	});

	it("says when checks failed, the branch conflicts, or GitHub won't show the checks", async () => {
		stubApi({
			[`GET ${PULL}`]: ok(githubPullRequestDetailJson({ reviewDecision: null })),
			[`GET ${PULL}/status`]: ok(
				githubPullRequestStatusJson(
					{ checks: { kind: "summary", state: "failure", successful: 2, failed: 1, pending: 0, skipped: 0 }, mergeability: "conflicting" },
					{ state: "dirty" },
				),
			),
		});
		await renderSignedIn(PULL_URL);

		const box = within(await screen.findByTestId("pull-request-merge-box"));
		expect(await box.findByText("Some checks were not successful")).toBeOnTheScreen();
		expect(box.getByText("1 failing, 2 successful checks")).toBeOnTheScreen();
		expect(box.getByText("This branch has conflicts that must be resolved")).toBeOnTheScreen();
		expect(box.queryByText("Review required")).toBeNull();
		// Merging is not offered over conflicts — and says why.
		expect(box.queryByRole("button", { name: "Merge pull request" })).toBeNull();
		expect(box.getByText("Resolve the conflicts on GitHub before merging.")).toBeOnTheScreen();
	});

	it("merges by the suggested method with GitHub's title, pinned to the head it read, and deletes the branch", async () => {
		const MERGE = `POST ${PULL}/merge`;
		const api = stubApi({
			[`GET ${PULL}`]: ok(githubPullRequestDetailJson()),
			[`GET ${PULL}/status`]: ok(githubPullRequestStatusJson()),
			[MERGE]: ok({ sha: "f".repeat(40), branch: { outcome: "deleted" } }, 201),
		});
		await renderSignedIn(PULL_URL);

		await fireEvent.press(await screen.findByRole("button", { name: "Merge pull request" }));
		const sheet = within(screen.getByTestId("pull-request-merge-sheet"));
		expect(sheet.getByRole("radio", { name: "Squash and merge" })).toBeChecked();
		expect(sheet.queryByRole("radio", { name: "Create a merge commit" })).toBeOnTheScreen();
		expect(sheet.getByTestId("pull-request-merge-title")).toHaveProp("value", "Add the login screen (#42)");
		expect(sheet.getByRole("checkbox", { name: "Delete branch feature/login after merge" })).toBeChecked();
		await fireEvent.press(sheet.getByRole("button", { name: "Confirm squash and merge" }));

		expect(await screen.findByText("Pull request merged and branch feature/login deleted.")).toBeOnTheScreen();
		const [call] = api.callsTo(MERGE);
		expect(JSON.parse(call?.body ?? "{}")).toEqual({
			method: "squash",
			expectedHeadSha: "a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0",
			commitTitle: "Add the login screen (#42)",
			commitMessage: "",
			deleteBranch: true,
		});
		expect(call?.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()]).toMatch(/^[0-9a-f-]{36}$/);
	});

	it("shows GitHub's reason in the sheet when it refuses the merge, and makes no commit title for a rebase", async () => {
		stubApi({
			[`GET ${PULL}`]: ok(githubPullRequestDetailJson()),
			[`GET ${PULL}/status`]: ok(githubPullRequestStatusJson()),
			[`POST ${PULL}/merge`]: fail(409, "GITHUB_WRITE_REJECTED", "GitHub refused this: Head branch was modified. Review and try the merge again."),
		});
		await renderSignedIn(PULL_URL);
		await fireEvent.press(await screen.findByRole("button", { name: "Merge pull request" }));
		const sheet = within(screen.getByTestId("pull-request-merge-sheet"));

		await fireEvent.press(sheet.getByRole("radio", { name: "Rebase and merge" }));
		expect(sheet.queryByTestId("pull-request-merge-title")).toBeNull();
		await fireEvent.press(sheet.getByRole("button", { name: "Confirm rebase and merge" }));

		expect(await sheet.findByText("GitHub refused this: Head branch was modified. Review and try the merge again.")).toBeOnTheScreen();
	});

	it("shows no merge box once the pull request is merged", async () => {
		stubApi({ [`GET ${PULL}`]: ok(githubPullRequestDetailJson({ state: "merged", mergedAt: 1_791_504_000_000, closedAt: 1_791_504_000_000 })) });
		await renderSignedIn(PULL_URL);

		await screen.findByRole("header", { name: "Add the login screen" });

		expect(screen.queryByTestId("pull-request-merge-box")).toBeNull();
	});

	it("draws the conversation on one line, and opens a pushed commit in the app", async () => {
		const sha = "1".padStart(40, "0");
		stubApi({
			[`GET ${PULL}`]: ok(
				githubPullRequestDetailJson({
					timeline: {
						items: [
							{
								type: "commit",
								commit: {
									sha,
									shortSha: sha.slice(0, 7),
									headline: "feat: login form",
									committedAt: 1_791_500_000_000,
									author: { name: "Octo Cat", login: "octocat", avatarUrl: null },
								},
							},
							{ type: "comment", comment: githubCommentJson("IC_author", "Thanks for looking.", { author: { login: "octocat", avatarUrl: null } }) },
						],
						nextCursor: null,
					},
				}),
			),
			[`GET ${PULL}/commits/${sha}`]: ok(githubCommitDetailJson(1)),
		});
		const app = await renderSignedIn(PULL_URL);

		expect(await screen.findByText("Thanks for looking.")).toBeOnTheScreen();
		// The pull request's author's comment carries GitHub's badge.
		expect(within(screen.getByTestId("comment-IC_author")).getByText("Author")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Commit 0000000: feat: login form" }));

		expect(await screen.findByLabelText("Added line 2: const b = 2;")).toBeOnTheScreen();
		expect(app.pathnameWithParams()).toBe(`/profile/pull-request-commit?owner=octo-org&repository=hello-world&number=42&sha=${sha}`);
	});

	it("puts Review changes beside Comment, not above it", async () => {
		stubApi({ [`GET ${PULL}`]: ok(githubPullRequestDetailJson()) });
		await renderSignedIn(PULL_URL);

		const composer = within(await screen.findByTestId("pull-request-comment-composer"));
		expect(composer.getByRole("button", { name: "Review changes" })).toBeOnTheScreen();
		expect(composer.getByRole("button", { name: "Comment" })).toBeOnTheScreen();
	});

	it("says so when the link names no pull request", async () => {
		stubApi({});
		await renderSignedIn("/profile/pull-request?owner=octo-org&repository=hello-world&number=zero");

		expect(await screen.findByText(INVALID_PULL_REQUEST_LINK_MESSAGE)).toBeOnTheScreen();
	});
});

describe("GitHub pull requests: changed files", () => {
	const FILES_URL = "/profile/pull-request-files?owner=octo-org&repository=hello-world&number=42";

	it("puts a line comment under the line it is on, and outdated ones above the diff", async () => {
		stubApi({
			[`GET ${PULL}/files?page=1`]: ok(githubPullRequestFilesJson()),
			[`GET ${PULL}/review-threads`]: ok({
				threads: [githubReviewThreadJson("T_current"), githubReviewThreadJson("T_old", { isOutdated: true, line: null, isResolved: true })],
				truncated: false,
			}),
		});
		await renderSignedIn(FILES_URL);

		const file = await screen.findByRole("button", { name: "src/app.ts. Modified. 2 lines added, 1 deleted, 2 comments" });
		expect(file).toBeExpanded();
		expect(await screen.findByText("Why two? (T_current)")).toBeOnTheScreen();
		expect(screen.getByText("Why two? (T_old)")).toBeOnTheScreen();
		expect(screen.getByText("Outdated · Resolved")).toBeOnTheScreen();
		// The thread sits after its line and before the next one.
		const order = screen.getAllByText(/^(const b = 2;|const c = 3;|Why two\? \(T_current\))$/).map((node): string => z.string().parse(node.props.children));
		expect(order).toEqual(["const b = 2;", "Why two? (T_current)", "const c = 3;"]);
	});

	it("says when the pull request has more line comments than shown", async () => {
		stubApi({ [`GET ${PULL}/files?page=1`]: ok(githubPullRequestFilesJson()), [`GET ${PULL}/review-threads`]: ok({ threads: [], truncated: true }) });
		await renderSignedIn(FILES_URL);

		expect(await screen.findByText(MORE_THREADS_ON_GITHUB)).toBeOnTheScreen();
	});

	it("loads the next page of files on request", async () => {
		stubApi({
			[`GET ${PULL}/files?page=1`]: ok(githubPullRequestFilesJson(2)),
			[`GET ${PULL}/files?page=2`]: ok(githubPullRequestFilesJson(null, "src/b.ts")),
			[`GET ${PULL}/review-threads`]: ok({ threads: [], truncated: false }),
		});
		await renderSignedIn(FILES_URL);

		await fireEvent.press(await screen.findByRole("button", { name: "Load more files" }));

		expect(await screen.findByRole("button", { name: /^src\/b\.ts\./ })).toBeOnTheScreen();
	});
});

describe("GitHub pull requests: commits", () => {
	it("opens a commit in the app with its diff, read with the linked token", async () => {
		const sha = "1".padStart(40, "0");
		stubApi({
			[`GET ${PULL}/commits`]: ok({ items: [githubCommitJson({ index: 1, headline: "feat: login form" })], nextCursor: null, totalCount: 1 }),
			[`GET ${PULL}/commits/${sha}`]: ok(githubCommitDetailJson(1)),
		});
		const app = await renderSignedIn("/profile/pull-request-commits?owner=octo-org&repository=hello-world&number=42");

		expect(await screen.findByText("1 commit")).toBeOnTheScreen();
		await fireEvent.press(screen.getByTestId("pull-request-commit-0000000"));

		expect(await screen.findByLabelText("Added line 2: const b = 2;")).toBeOnTheScreen();
		expect(app.pathnameWithParams()).toBe(`/profile/pull-request-commit?owner=octo-org&repository=hello-world&number=42&sha=${sha}`);
	});
});

describe("GitHub pull requests: commenting and reviewing (synced to GitHub)", () => {
	const COMMENTS = `POST ${PULL}/comments`;
	const REVIEWS = `POST ${PULL}/reviews`;
	const REVIEWER_VIEW = githubPullRequestDetailJson({ viewerDidAuthor: false });

	it("posts a comment with an Idempotency-Key, then reloads the conversation", async () => {
		const api = stubApi({
			[`GET ${PULL}`]: ok(REVIEWER_VIEW),
			[COMMENTS]: ok(githubCommentJson("IC_new", "Ship it."), 201),
		});
		await renderSignedIn(PULL_URL);

		await fireEvent.changeText(await screen.findByTestId("pull-request-comment-field"), "Ship it.");
		await fireEvent.press(screen.getByTestId("pull-request-comment-submit"));

		expect(await screen.findByText(COMMENT_POSTED_MESSAGE)).toBeOnTheScreen();
		const [call] = api.callsTo(COMMENTS);
		expect(call?.body).toBe(JSON.stringify({ body: "Ship it." }));
		expect(call?.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()]).toMatch(/^[0-9a-f-]{36}$/);
		await waitFor(() => {
			expect(api.callsTo(`GET ${PULL}`)).toHaveLength(2);
		});
		expect(screen.getByTestId("pull-request-comment-field")).toHaveProp("value", "");
	});

	it("sends the same key when a failed comment is sent again, so GitHub never gets it twice", async () => {
		let attempts = 0;
		const api = stubApi({
			[`GET ${PULL}`]: ok(REVIEWER_VIEW),
			[COMMENTS]: dynamic(() => {
				attempts += 1;
				return attempts === 1 ? fail(503, "SERVICE_UNAVAILABLE", "GitHub could not be reached. Try again shortly.") : ok(githubCommentJson("IC_new", "Ship it."), 201);
			}),
		});
		await renderSignedIn(PULL_URL);
		const field = await screen.findByTestId("pull-request-comment-field");

		await fireEvent.changeText(field, "Ship it.");
		await fireEvent.press(screen.getByTestId("pull-request-comment-submit"));
		expect(await screen.findByText("GitHub could not be reached. Try again shortly.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByTestId("pull-request-comment-submit"));
		await screen.findByText(COMMENT_POSTED_MESSAGE);

		const [first, retry] = api.callsTo(COMMENTS).map((call) => call.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()]);
		expect(retry).toBe(first);
	});

	it("checks a blank comment with the shared schema, before anything is sent", async () => {
		const api = stubApi({ [`GET ${PULL}`]: ok(REVIEWER_VIEW) });
		await renderSignedIn(PULL_URL);

		await fireEvent.changeText(await screen.findByTestId("pull-request-comment-field"), "   ");
		await fireEvent.press(screen.getByTestId("pull-request-comment-submit"));

		expect(await screen.findByText("Write something first")).toBeOnTheScreen();
		expect(api.callsTo(COMMENTS)).toHaveLength(0);
	});

	it("approves from Review changes, with GitHub's three verdicts", async () => {
		const api = stubApi({
			[`GET ${PULL}`]: ok(REVIEWER_VIEW),
			[REVIEWS]: ok(
				{
					...githubCommentJson("PRR_new", ""),
					state: "approved",
					submittedAt: 1_791_504_000_000,
					comments: [],
					commentCount: 0,
				},
				201,
			),
		});
		await renderSignedIn(PULL_URL);

		await fireEvent.press(await screen.findByRole("button", { name: "Review changes" }));
		const sheet = within(await screen.findByTestId("pull-request-review-sheet"));
		expect(sheet.getByRole("radio", { name: "Comment" })).toBeChecked();
		expect(sheet.getByRole("radio", { name: "Request changes" })).toBeOnTheScreen();
		await fireEvent.press(sheet.getByRole("radio", { name: "Approve" }));
		await fireEvent.press(sheet.getByTestId("pull-request-review-submit"));

		expect(await screen.findByText(REVIEW_SUBMITTED_MESSAGE)).toBeOnTheScreen();
		const [call] = api.callsTo(REVIEWS);
		expect(call?.body).toBe(JSON.stringify({ event: "approve", body: "" }));
		expect(call?.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()]).toMatch(/^[0-9a-f-]{36}$/);
	});

	it("asks for a summary to request changes", async () => {
		const api = stubApi({ [`GET ${PULL}`]: ok(REVIEWER_VIEW) });
		await renderSignedIn(PULL_URL);

		await fireEvent.press(await screen.findByRole("button", { name: "Review changes" }));
		const sheet = within(await screen.findByTestId("pull-request-review-sheet"));
		await fireEvent.press(sheet.getByRole("radio", { name: "Request changes" }));
		await fireEvent.press(sheet.getByTestId("pull-request-review-submit"));

		expect(await sheet.findByText("Write a summary to comment or request changes")).toBeOnTheScreen();
		expect(api.callsTo(REVIEWS)).toHaveLength(0);
	});

	it("offers an author only a comment review, as GitHub does", async () => {
		stubApi({ [`GET ${PULL}`]: ok(githubPullRequestDetailJson()) });
		await renderSignedIn(PULL_URL);

		await fireEvent.press(await screen.findByRole("button", { name: "Review changes" }));
		const sheet = within(await screen.findByTestId("pull-request-review-sheet"));

		expect(sheet.getByRole("radio", { name: "Comment" })).toBeOnTheScreen();
		expect(sheet.queryByRole("radio", { name: "Approve" })).toBeNull();
		expect(sheet.getByText(OWN_PULL_REQUEST_REVIEW_NOTE)).toBeOnTheScreen();
	});

	it("shows GitHub's reason when it refuses a review", async () => {
		stubApi({
			[`GET ${PULL}`]: ok(REVIEWER_VIEW),
			[REVIEWS]: fail(409, "GITHUB_WRITE_REJECTED", "GitHub refused this: Pull request is locked"),
		});
		await renderSignedIn(PULL_URL);

		await fireEvent.press(await screen.findByRole("button", { name: "Review changes" }));
		const sheet = within(await screen.findByTestId("pull-request-review-sheet"));
		await fireEvent.press(sheet.getByRole("radio", { name: "Approve" }));
		await fireEvent.press(sheet.getByTestId("pull-request-review-submit"));

		expect(await sheet.findByText("GitHub refused this: Pull request is locked")).toBeOnTheScreen();
	});

	it("offers no review on a closed pull request", async () => {
		stubApi({ [`GET ${PULL}`]: ok(githubPullRequestDetailJson({ state: "closed", closedAt: 1_791_504_000_000 })) });
		await renderSignedIn(PULL_URL);

		await screen.findByRole("header", { name: "Add the login screen" });

		expect(screen.queryByRole("button", { name: "Review changes" })).toBeNull();
	});
});

describe("GitHub pull requests: pictures in comments", () => {
	const ATTACHMENT_ID = "cb5fe4d3-85fb-4d1e-807a-1771925051be";
	const ATTACHMENT = `https://github.com/user-attachments/assets/${ATTACHMENT_ID}`;
	/** Where the API lists an upload to a private repository: its own lasting address (any host — the app asks its own API). */
	const LISTED = `https://api.example.com/api/v1/github/pictures/uploads/${ATTACHMENT_ID}?node=IC_shot`;
	/** The same picture, asked for from the API the app talks to. */
	const SERVED = `${TEST_API_URL}/api/v1/github/pictures/uploads/${ATTACHMENT_ID}?node=IC_shot`;
	const FILE_ID = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";
	const USER_ID = "7c1e2b3a-4d5f-4a6b-8c7d-9e0f1a2b3c4d";
	const REPOSITORY_URL = `https://github.com/octo-org/hello-world/raw/github-comment-assets/pull-requests/42/${FILE_ID}.png`;
	const PHOTO = { uri: "file:///photos/shot.png", fileName: "shot.png", mimeType: "image/png", fileSize: 4, width: 640, height: 480 };
	const WITH_SCREENSHOT = githubPullRequestDetailJson({
		viewerDidAuthor: false,
		timeline: {
			items: [
				{
					type: "comment",
					comment: githubCommentJson("IC_shot", `<img width="735" height="490" alt="screenshot" src="${ATTACHMENT}" />`, {
						images: [{ source: ATTACHMENT, url: LISTED }],
					}),
				},
			],
			nextCursor: null,
		},
	});

	function fileJson(status: string, publicUrl: string | null): DataValue {
		return {
			file: {
				id: FILE_ID,
				category: "GITHUB_COMMENT_IMAGE",
				visibility: "PRIVATE",
				originalName: "shot.png",
				mimeType: "image/png",
				sizeBytes: 4,
				status,
				scanStatus: status === "READY" ? "NOT_SCANNED" : null,
				publicUrl,
				uploadedAt: 0,
			},
		};
	}

	function uploadRoutes(): Record<string, StubRoute> {
		return {
			"GET /auth/me": ok(userJson({ id: USER_ID })),
			"POST /files/upload-url": ok({
				fileId: FILE_ID,
				objectPath: "staging/users/user-1/github-comment-images/shot.png",
				expiresIn: 300,
				method: "POST_MULTIPART",
				uploadUrl: "https://storage.example.com/upload",
				fields: { key: "staging/users/user-1/github-comment-images/shot.png", token: "signed" },
			}),
			[`POST /files/${FILE_ID}/complete`]: ok(fileJson("SCANNING", null)),
			[`GET /files/${FILE_ID}`]: ok(fileJson("READY", null)),
			[`POST ${PULL}/pictures`]: ok({ url: REPOSITORY_URL, path: `pull-requests/42/${FILE_ID}.png` }, 201),
		};
	}

	it("draws a screenshot pasted on GitHub from the API, signed in — never from a link that expires — and opens it full screen", async () => {
		stubApi({ [`GET ${PULL}`]: ok(WITH_SCREENSHOT) });
		await renderSignedIn(PULL_URL);
		const signedIn = { uri: SERVED, headers: { Authorization: `Bearer ${testAccessToken()}` } };

		const picture = await screen.findByRole("imagebutton", { name: "screenshot" });
		// expo-image keeps its sources as a list.
		expect(await within(picture).findByTestId("markdown-picture-image")).toHaveProp("source", [signedIn]);
		expect(screen.queryByText(/<img/)).toBeNull();

		await fireEvent.press(picture);

		expect(within(screen.getByTestId("image-viewer")).getByTestId("image-viewer-image")).toHaveProp("source", [signedIn]);
		await fireEvent.press(screen.getByRole("button", { name: "Close image" }));
		expect(screen.queryByTestId("image-viewer-image")).toBeNull();
	});

	it("renews the session when a picture fails on an expired token, and asks for it again with the new one", async () => {
		const api = stubApi({ [`GET ${PULL}`]: ok(WITH_SCREENSHOT), "GET /auth/me": ok(userJson()) });
		const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
		await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
		await renderInApp(runtime, SCREENS, PULL_URL);
		const picture = await screen.findByTestId("markdown-picture-image");
		expect(picture).toHaveProp("source", [{ uri: SERVED, headers: { Authorization: `Bearer ${testAccessToken()}` } }]);
		const meBefore = api.callsTo("GET /auth/me").length;
		// The access token expired; the api-client renews it on the next authenticated read.
		await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken({}, "renewed"), refreshToken: "refresh-2" });

		await fireEvent(picture, "error", { nativeEvent: { error: "401" } });

		await waitFor(() => {
			expect(screen.getByTestId("markdown-picture-image")).toHaveProp("source", [{ uri: SERVED, headers: { Authorization: `Bearer ${testAccessToken({}, "renewed")}` } }]);
		});
		expect(api.callsTo("GET /auth/me").length).toBe(meBefore + 1);
	});

	it("says a picture can't be shown, and offers it in the browser, when it fails to load", async () => {
		const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
		stubApi({ [`GET ${PULL}`]: ok(WITH_SCREENSHOT) });
		await renderSignedIn(PULL_URL);

		await fireEvent(await screen.findByTestId("markdown-picture-image"), "error", { nativeEvent: { error: "403" } });

		expect(screen.getByText("screenshot can't be shown here.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("link", { name: "Open in browser" }));
		expect(openUrl).toHaveBeenCalledWith(ATTACHMENT);
	});

	it("adds a picture to a comment: uploads it, asks where it will be in the repository, then links it in the text", async () => {
		const api = stubApi({ [`GET ${PULL}`]: ok(REVIEWER_VIEW_FOR_PICTURES), ...uploadRoutes() });
		fileSystem.putFile(PHOTO.uri, new Uint8Array([1, 2, 3, 4]));
		imagePicker.pickNext(PHOTO);
		await renderSignedIn(PULL_URL);
		const field = await screen.findByTestId("pull-request-comment-field");
		await fireEvent.changeText(field, "Here it is:");
		await waitFor(() => {
			expect(api.callsTo("GET /auth/me").length).toBeGreaterThan(0);
		});

		await fireEvent.press(screen.getByRole("button", { name: "Add a picture" }));

		await waitFor(() => {
			expect(screen.getByTestId("pull-request-comment-field")).toHaveProp("value", `Here it is:\n![shot](${REPOSITORY_URL})`);
		});
		const [ticket] = api.callsTo("POST /files/upload-url");
		expect(JSON.parse(ticket?.body ?? "{}")).toMatchObject({
			category: "GITHUB_COMMENT_IMAGE",
			userId: USER_ID,
			fileName: "shot.png",
			mimeType: "image/png",
			sizeBytes: 4,
			// SHA-256 of the bytes 01 02 03 04.
			checksumSha256: "9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a",
		});
		expect(fileSystem.uploads()).toMatchObject([
			{
				uri: PHOTO.uri,
				url: "https://storage.example.com/upload",
				options: { httpMethod: "POST", fieldName: "file", mimeType: "image/png", parameters: { key: "staging/users/user-1/github-comment-images/shot.png", token: "signed" } },
			},
		]);
		expect(api.callsTo(`POST /files/${FILE_ID}/complete`)).toHaveLength(1);
		const [commit] = api.callsTo(`POST ${PULL}/pictures`);
		expect(commit?.body).toBe(JSON.stringify({ fileId: FILE_ID }));
		expect(commit?.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()]).toMatch(/^[0-9a-f-]{36}$/);
		expect(imagePicker.openings()).toMatchObject([{ mediaTypes: ["images"] }]);
	});

	it("takes the placeholder out and says why when storage refuses the picture", async () => {
		const api = stubApi({ [`GET ${PULL}`]: ok(REVIEWER_VIEW_FOR_PICTURES), ...uploadRoutes() });
		fileSystem.putFile(PHOTO.uri, new Uint8Array([1, 2, 3, 4]));
		fileSystem.answerUploadsWith(403);
		imagePicker.pickNext(PHOTO);
		await renderSignedIn(PULL_URL);
		await fireEvent.changeText(await screen.findByTestId("pull-request-comment-field"), "Here it is:");
		await waitFor(() => {
			expect(api.callsTo("GET /auth/me").length).toBeGreaterThan(0);
		});

		await fireEvent.press(screen.getByRole("button", { name: "Add a picture" }));

		expect(await screen.findByText("Storage refused the upload (HTTP 403). Try again.")).toBeOnTheScreen();
		expect(screen.getByTestId("pull-request-comment-field")).toHaveProp("value", "Here it is:");
		expect(api.callsTo(`POST /files/${FILE_ID}/complete`)).toHaveLength(0);
	});

	it("takes the placeholder out and names the missing permission when the token may not commit to the repository", async () => {
		const message = 'Your GitHub token can\'t write to octo-org/hello-world. Give it "Contents: Read and write" access to that repository on GitHub, then try again.';
		stubApi({ [`GET ${PULL}`]: ok(REVIEWER_VIEW_FOR_PICTURES), ...uploadRoutes(), [`POST ${PULL}/pictures`]: fail(409, "GITHUB_WRITE_REJECTED", message) });
		fileSystem.putFile(PHOTO.uri, new Uint8Array([1, 2, 3, 4]));
		imagePicker.pickNext(PHOTO);
		await renderSignedIn(PULL_URL);
		await fireEvent.changeText(await screen.findByTestId("pull-request-comment-field"), "Here it is:");
		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Add a picture" })).toBeEnabled();
		});

		await fireEvent.press(screen.getByRole("button", { name: "Add a picture" }));

		expect(await screen.findByText(message)).toBeOnTheScreen();
		expect(screen.getByTestId("pull-request-comment-field")).toHaveProp("value", "Here it is:");
	});

	it("refuses a picture of another type before uploading anything", async () => {
		const api = stubApi({ [`GET ${PULL}`]: ok(REVIEWER_VIEW_FOR_PICTURES), ...uploadRoutes() });
		imagePicker.pickNext({ ...PHOTO, fileName: "shot.heic", mimeType: "image/heic" });
		await renderSignedIn(PULL_URL);
		await screen.findByTestId("pull-request-comment-field");
		await waitFor(() => {
			expect(api.callsTo("GET /auth/me").length).toBeGreaterThan(0);
		});

		await fireEvent.press(screen.getByRole("button", { name: "Add a picture" }));

		expect(await screen.findByText("Attach a JPEG, PNG or WebP picture.")).toBeOnTheScreen();
		expect(api.callsTo("POST /files/upload-url")).toHaveLength(0);
	});
});

describe("GitHub pull requests: reactions", () => {
	const REACTIONS = `PUT ${PULL}/reactions`;
	const WITH_REACTIONS = githubPullRequestDetailJson({
		viewerDidAuthor: false,
		reactions: [{ content: "rocket", count: 2, viewerHasReacted: false }],
		timeline: {
			items: [
				{ type: "comment", comment: githubCommentJson("IC_first", "Looks good to me.", { reactions: [{ content: "heart", count: 1, viewerHasReacted: true }] }) },
				{
					type: "review",
					review: {
						...githubCommentJson("PRR_1", "Nice work.", { reactions: [{ content: "eyes", count: 1, viewerHasReacted: false }], reactionSubject: null }),
						state: "commented",
						submittedAt: null,
						comments: [],
						commentCount: 0,
					},
				},
			],
			nextCursor: null,
		},
	});

	/** GitHub's answer to `PUT …/reactions`: the reaction as sent, checked with the shared schema. */
	function reactionAnswer(call: { readonly body: string | null }): StubResponse {
		return ok(SetGithubReactionSchema.parse(JSON.parse(call.body ?? "{}")));
	}

	it("shows each comment's reactions, and takes your own away on GitHub with a tap", async () => {
		const api = stubApi({ [`GET ${PULL}`]: ok(WITH_REACTIONS), [REACTIONS]: dynamic(reactionAnswer) });
		await renderSignedIn(PULL_URL);

		const heart = await screen.findByRole("togglebutton", { name: "heart: 1 person, including you" });
		expect(screen.getByRole("togglebutton", { name: "rocket: 2 people" })).toBeOnTheScreen();
		await fireEvent.press(heart);

		await waitFor(() => {
			expect(api.callsTo(REACTIONS)).toHaveLength(1);
		});
		expect(JSON.parse(api.callsTo(REACTIONS).at(0)?.body ?? "{}")).toEqual({ subject: { type: "issueComment", commentId: "6186769145" }, content: "heart", reacted: false });
		expect(screen.queryByRole("togglebutton", { name: /^heart/ })).toBeNull();
		await waitFor(() => {
			expect(api.callsTo(`GET ${PULL}`)).toHaveLength(2);
		});
	});

	it("adds a reaction to the description from the picker of GitHub's eight", async () => {
		const api = stubApi({ [`GET ${PULL}`]: ok(WITH_REACTIONS), [REACTIONS]: dynamic(reactionAnswer) });
		await renderSignedIn(PULL_URL);
		const description = within(await screen.findByTestId("reactions-PR_kwDOtest42"));

		await fireEvent.press(description.getByRole("button", { name: "Add a reaction" }));
		const picker = within(screen.getByTestId("reaction-picker"));
		expect(picker.getAllByRole("togglebutton")).toHaveLength(8);
		for (const name of ["thumbs up", "thumbs down", "laugh", "hooray", "confused", "heart", "rocket", "eyes"]) {
			expect(picker.getByRole("togglebutton", { name })).toBeOnTheScreen();
		}
		await fireEvent.press(picker.getByRole("togglebutton", { name: "thumbs up" }));

		expect(await description.findByRole("togglebutton", { name: "thumbs up: 1 person, including you" })).toBeOnTheScreen();
		await waitFor(() => {
			expect(api.callsTo(REACTIONS)).toHaveLength(1);
		});
		expect(JSON.parse(api.callsTo(REACTIONS).at(0)?.body ?? "{}")).toEqual({ subject: { type: "pullRequest" }, content: "thumbsUp", reacted: true });
	});

	it("shows a review summary's reactions without offering to change them (GitHub takes none from an API)", async () => {
		stubApi({ [`GET ${PULL}`]: ok(WITH_REACTIONS) });
		await renderSignedIn(PULL_URL);

		const review = within(await screen.findByTestId("reactions-PRR_1"));
		expect(review.getByText("👀")).toBeOnTheScreen();
		expect(review.queryByRole("button", { name: "Add a reaction" })).toBeNull();
	});

	it("puts the reaction back and says why when GitHub refuses it", async () => {
		stubApi({
			[`GET ${PULL}`]: ok(WITH_REACTIONS),
			[REACTIONS]: fail(409, "GITHUB_WRITE_REJECTED", "Your GitHub token can't write to octo-org/hello-world."),
		});
		await renderSignedIn(PULL_URL);

		await fireEvent.press(await screen.findByRole("togglebutton", { name: "rocket: 2 people" }));

		expect(await screen.findByText("Your GitHub token can't write to octo-org/hello-world.")).toBeOnTheScreen();
		expect(screen.getByRole("togglebutton", { name: "rocket: 2 people" })).toBeOnTheScreen();
	});
});

describe("GitHub pull requests: live updates", () => {
	const LIVE = "GET /github/live-updates/octo-org/hello-world";
	const LIVE_PUT = "PUT /github/live-updates/octo-org/hello-world";

	/** The stream the screen opens: the test pushes frames into it. */
	function openLiveStream(): { readonly push: (frame: string) => void; readonly urls: () => string[] } {
		const encoder = new TextEncoder();
		let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
		mockExpoFetch.mockImplementation(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				body: new ReadableStream<Uint8Array>({
					start(streamController): void {
						controller = streamController;
					},
				}),
			}),
		);
		return {
			push: (frame: string): void => {
				controller?.enqueue(encoder.encode(frame));
			},
			urls: (): string[] => mockExpoFetch.mock.calls.map(([url]): string => url),
		};
	}

	it("shows nothing when the server has no live updates", async () => {
		stubApi({ [`GET ${PULL}`]: ok(githubPullRequestDetailJson()), [LIVE]: ok({ status: "off" }) });
		await renderSignedIn(PULL_URL);
		await screen.findByRole("header", { name: "Add the login screen" });

		expect(screen.queryByTestId("pull-request-live-updates")).toBeNull();
	});

	it("turns live updates on for the repository", async () => {
		let enabled = false;
		const api = stubApi({
			[`GET ${PULL}`]: ok(githubPullRequestDetailJson()),
			[LIVE]: dynamic(() => ok(enabled ? { status: "enabled", enabledAt: 1 } : { status: "disabled" })),
			[LIVE_PUT]: dynamic(() => {
				enabled = true;
				return ok({ status: "enabled", enabledAt: 1 });
			}),
		});
		openLiveStream();
		await renderSignedIn(PULL_URL);

		await fireEvent.press(await screen.findByRole("button", { name: "Turn live updates on" }));

		expect(await screen.findByRole("button", { name: "Turn live updates off" })).toBeOnTheScreen();
		expect(api.callsTo(LIVE_PUT)).toHaveLength(1);
		expect(screen.getByLabelText(`Live updates on. ${LIVE_UPDATES_ON_DETAIL}`)).toBeOnTheScreen();
	});

	it("reloads the pull request when a change to it arrives, and not for another one", async () => {
		const api = stubApi({ [`GET ${PULL}`]: ok(githubPullRequestDetailJson()), [LIVE]: ok({ status: "enabled", enabledAt: 1 }) });
		const stream = openLiveStream();
		await renderSignedIn(PULL_URL);
		await screen.findByLabelText(`Live updates on. ${LIVE_UPDATES_ON_DETAIL}`);
		await waitFor(() => {
			expect(stream.urls()).toEqual(["http://api.test/api/v1/github/live-updates/octo-org/hello-world/events"]);
		});

		stream.push('data: {"owner":"octo-org","repository":"hello-world","number":7}\n\n');
		stream.push('data: {"owner":"Octo-Org","repository":"Hello-World","number":42}\n\n');

		await waitFor(() => {
			expect(api.callsTo(`GET ${PULL}`)).toHaveLength(2);
		});
	});
});

describe("GitHub pull requests: the token", () => {
	it("links a fine-grained token, checked with the shared schema first", async () => {
		const api = stubApi({
			"GET /github/account": dynamic((): ReturnType<typeof ok> => ok(api.callsTo("PUT /github/account").length === 0 ? { status: "unlinked" } : githubAccountLinkedJson())),
			"PUT /github/account": ok(githubAccountLinkedJson()),
		});
		await renderSignedIn("/profile/github-account");
		const field = await screen.findByTestId("github-token-field");

		await fireEvent.changeText(field, "ghp_classic_token");
		await fireEvent.press(screen.getByTestId("github-token-submit"));
		expect(await screen.findByText(/must be a fine-grained personal access token/)).toBeOnTheScreen();
		expect(api.callsTo("PUT /github/account")).toHaveLength(0);

		await fireEvent.changeText(field, VALID_TOKEN);
		await fireEvent.press(screen.getByTestId("github-token-submit"));

		expect(await screen.findByText(TOKEN_LINKED_MESSAGE)).toBeOnTheScreen();
		expect(api.callsTo("PUT /github/account").map((call) => call.body)).toEqual([JSON.stringify({ personalAccessToken: VALID_TOKEN })]);
		expect(await screen.findByText("octocat")).toBeOnTheScreen();
	});

	it("explains a token GitHub refuses", async () => {
		stubApi({ "GET /github/account": ok({ status: "unlinked" }), "PUT /github/account": fail(400, "GITHUB_TOKEN_INVALID", "GitHub did not accept this token.") });
		await renderSignedIn("/profile/github-account");

		await fireEvent.changeText(await screen.findByTestId("github-token-field"), VALID_TOKEN);
		await fireEvent.press(screen.getByTestId("github-token-submit"));

		expect(await screen.findByText("GitHub did not accept this token.")).toBeOnTheScreen();
	});

	it("removes the token after confirming", async () => {
		const api = stubApi({
			"GET /github/account": dynamic((): ReturnType<typeof ok> => ok(api.callsTo("DELETE /github/account").length === 0 ? githubAccountLinkedJson() : { status: "unlinked" })),
			"DELETE /github/account": ok({ status: "unlinked" }),
		});
		await renderSignedIn("/profile/github-account");

		await fireEvent.press(await screen.findByRole("button", { name: "Remove token" }));
		await fireEvent.press(await screen.findByRole("button", { name: "Remove" }));

		expect(await screen.findByText(TOKEN_UNLINKED_MESSAGE)).toBeOnTheScreen();
		expect(api.callsTo("DELETE /github/account")).toHaveLength(1);
		await waitFor(() => {
			expect(screen.queryByRole("button", { name: "Remove token" })).toBeNull();
		});
	});

	it("says when GitHub stopped accepting the token, and opens GitHub's token page", async () => {
		const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValueOnce(true);
		stubApi({ "GET /github/account": ok(githubAccountLinkedJson("rejected")) });
		await renderSignedIn("/profile/github-account");

		expect(await screen.findByText("GitHub no longer accepts the token of octocat. Link a new one to continue.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Create a token on GitHub" }));

		expect(openUrl).toHaveBeenCalledWith(GITHUB_NEW_TOKEN_URL);
	});
});
