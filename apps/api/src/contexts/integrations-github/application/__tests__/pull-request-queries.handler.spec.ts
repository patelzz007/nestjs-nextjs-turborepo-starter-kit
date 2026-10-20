import { describe, expect, it } from "vitest";

import { AuthenticationError } from "../../../../platform/application/errors/app-error";
import { GithubAccountNotLinkedError, GithubLinkedTokenRejectedError, GithubPullRequestsOffError } from "../errors/github.errors";
import { GetContentEditHistoryHandler } from "../queries/get-content-edit-history/get-content-edit-history.handler";
import { GetContentEditHistoryQuery } from "../queries/get-content-edit-history/get-content-edit-history.query";
import { GetPullRequestCommitHandler } from "../queries/get-pull-request-commit/get-pull-request-commit.handler";
import { GetPullRequestCommitQuery } from "../queries/get-pull-request-commit/get-pull-request-commit.query";
import { GetPullRequestCommitsHandler } from "../queries/get-pull-request-commits/get-pull-request-commits.handler";
import { GetPullRequestCommitsQuery } from "../queries/get-pull-request-commits/get-pull-request-commits.query";
import { GetPullRequestDetailHandler } from "../queries/get-pull-request-detail/get-pull-request-detail.handler";
import { GetPullRequestDetailQuery } from "../queries/get-pull-request-detail/get-pull-request-detail.query";
import { GetPullRequestFilesHandler } from "../queries/get-pull-request-files/get-pull-request-files.handler";
import { GetPullRequestFilesQuery } from "../queries/get-pull-request-files/get-pull-request-files.query";
import { GetPullRequestReviewThreadsHandler } from "../queries/get-pull-request-review-threads/get-pull-request-review-threads.handler";
import { GetPullRequestReviewThreadsQuery } from "../queries/get-pull-request-review-threads/get-pull-request-review-threads.query";
import { GetPullRequestStatusHandler } from "../queries/get-pull-request-status/get-pull-request-status.handler";
import { GetPullRequestStatusQuery } from "../queries/get-pull-request-status/get-pull-request-status.query";
import { GetPullRequestTimelineHandler } from "../queries/get-pull-request-timeline/get-pull-request-timeline.handler";
import { GetPullRequestTimelineQuery } from "../queries/get-pull-request-timeline/get-pull-request-timeline.query";
import { ListPullRequestsHandler } from "../queries/list-pull-requests/list-pull-requests.handler";
import { ListPullRequestsQuery } from "../queries/list-pull-requests/list-pull-requests.query";
import {
	anonymousActor,
	COMMIT_DETAIL,
	COMMIT_PAGE,
	CONTENT_EDITS,
	FILE_PAGE,
	HEAD_SHA,
	PULL_REQUEST,
	PULL_REQUEST_DETAIL,
	PULL_REQUEST_PAGE,
	PULL_REQUEST_STATUS,
	REVIEW_THREADS,
	TIMELINE_PAGE,
	USER_ID,
	userActor,
} from "./fakes/github-contract.fixtures";
import { tokenRejected } from "./fakes/github-fakes";
import { githubHarness, LINKED_TOKEN, linkToken, type GithubHarness } from "./fakes/github-harness";
import type { ActorContext } from "../../../../platform/application/actor-context";

/** One read endpoint: run it as `actor`, and the view, input and answer it must produce. */
interface ReadCase {
	readonly name: string;
	readonly run: (harness: GithubHarness, actor: ActorContext) => Promise<object>;
	readonly view: string;
	readonly input: string;
	readonly answer: object;
}

const NODE_ID = "IC_kwDOAbCdEf";

const CASES: readonly ReadCase[] = [
	{
		name: "ListPullRequests",
		run: (h, actor) => new ListPullRequestsHandler(h.credentials, h.reads).execute(new ListPullRequestsQuery(actor, { filter: "created", state: "closed" })),
		view: "list",
		input: JSON.stringify({ filter: "created", state: "closed" }),
		answer: PULL_REQUEST_PAGE,
	},
	{
		name: "GetPullRequestDetail",
		run: (h, actor) => new GetPullRequestDetailHandler(h.credentials, h.reads).execute(new GetPullRequestDetailQuery(actor, PULL_REQUEST)),
		view: "detail",
		input: JSON.stringify(PULL_REQUEST),
		answer: PULL_REQUEST_DETAIL,
	},
	{
		name: "GetPullRequestTimeline",
		run: (h, actor) => new GetPullRequestTimelineHandler(h.credentials, h.reads).execute(new GetPullRequestTimelineQuery(actor, { params: PULL_REQUEST, cursor: "Y3Vyc29y" })),
		view: "timeline",
		input: JSON.stringify({ params: PULL_REQUEST, cursor: "Y3Vyc29y" }),
		answer: TIMELINE_PAGE,
	},
	{
		name: "GetPullRequestCommits (first page)",
		run: (h, actor) => new GetPullRequestCommitsHandler(h.credentials, h.reads).execute(new GetPullRequestCommitsQuery(actor, { params: PULL_REQUEST, cursor: undefined })),
		view: "commits",
		input: JSON.stringify({ params: PULL_REQUEST, cursor: null }),
		answer: COMMIT_PAGE,
	},
	{
		name: "GetPullRequestStatus",
		run: (h, actor) => new GetPullRequestStatusHandler(h.credentials, h.reads).execute(new GetPullRequestStatusQuery(actor, PULL_REQUEST)),
		view: "status",
		input: JSON.stringify(PULL_REQUEST),
		answer: PULL_REQUEST_STATUS,
	},
	{
		name: "GetPullRequestCommit",
		run: (h, actor) => new GetPullRequestCommitHandler(h.credentials, h.reads).execute(new GetPullRequestCommitQuery(actor, { ...PULL_REQUEST, sha: HEAD_SHA })),
		view: "commit",
		input: JSON.stringify({ ...PULL_REQUEST, sha: HEAD_SHA }),
		answer: COMMIT_DETAIL,
	},
	{
		name: "GetPullRequestFiles (last page)",
		run: (h, actor) => new GetPullRequestFilesHandler(h.credentials, h.reads).execute(new GetPullRequestFilesQuery(actor, { params: PULL_REQUEST, page: 30 })),
		view: "files",
		input: JSON.stringify({ params: PULL_REQUEST, page: 30 }),
		answer: FILE_PAGE,
	},
	{
		name: "GetPullRequestReviewThreads",
		run: (h, actor) => new GetPullRequestReviewThreadsHandler(h.credentials, h.reads).execute(new GetPullRequestReviewThreadsQuery(actor, PULL_REQUEST)),
		view: "reviewThreads",
		input: JSON.stringify(PULL_REQUEST),
		answer: REVIEW_THREADS,
	},
	{
		name: "GetContentEditHistory",
		run: (h, actor) => new GetContentEditHistoryHandler(h.credentials, h.reads).execute(new GetContentEditHistoryQuery(actor, { nodeId: NODE_ID })),
		view: "contentEdits",
		input: NODE_ID,
		answer: CONTENT_EDITS,
	},
];

describe.each(CASES)("$name", ({ run, view, input, answer }: ReadCase) => {
	it("reads with the caller's own token, keyed to the caller, and answers in our contract", async () => {
		const harness = githubHarness();
		await linkToken(harness);

		await expect(run(harness, userActor())).resolves.toEqual(answer);
		expect(harness.reads.reads).toEqual([{ view, userId: USER_ID, token: LINKED_TOKEN, input }]);
	});

	it("asks to link a token first, reading nothing from GitHub", async () => {
		const harness = githubHarness();

		await expect(run(harness, userActor())).rejects.toBeInstanceOf(GithubAccountNotLinkedError);
		expect(harness.reads.reads).toEqual([]);
	});

	it("answers 503 when pull requests are off", async () => {
		const harness = githubHarness();
		harness.cipher.enabled = false;

		await expect(run(harness, userActor())).rejects.toBeInstanceOf(GithubPullRequestsOffError);
	});

	it("records a token GitHub refuses as rejected and drops the user's cached reads", async () => {
		const harness = githubHarness();
		await linkToken(harness);
		harness.reads.failure = tokenRejected();

		await expect(run(harness, userActor())).rejects.toBeInstanceOf(GithubLinkedTokenRejectedError);
		expect(harness.links.rows.get(USER_ID)?.status).toBe("REJECTED");
		expect(harness.cache.users).toEqual([USER_ID]);
	});

	it("serves no one but a signed-in user", async () => {
		await expect(run(githubHarness(), anonymousActor())).rejects.toBeInstanceOf(AuthenticationError);
	});
});
