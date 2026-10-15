import { apiRouter } from "@workspace/api-client";

import { createTestQueryClient } from "../../../test/query-clients";
import { refreshAllPullRequests, refreshPullRequest } from "./refresh";

const PULL_42 = { owner: "octo-org", repository: "hello-world", number: 42 };
const PULL_7 = { owner: "octo-org", repository: "hello-world", number: 7 };

function seed(): ReturnType<typeof createTestQueryClient> {
	const queryClient = createTestQueryClient();
	for (const key of [
		apiRouter.githubPullRequests.account.queryKey(undefined),
		apiRouter.githubPullRequests.list.queryKey({ filter: "yours", state: "open" }),
		apiRouter.githubPullRequests.detail.queryKey(PULL_42),
		apiRouter.githubPullRequests.files.queryKey({ ...PULL_42, page: 1 }),
		apiRouter.githubPullRequests.reviewThreads.queryKey(PULL_42),
		apiRouter.githubPullRequests.detail.queryKey(PULL_7),
		apiRouter.auth.profile.queryKey(undefined),
	]) {
		queryClient.setQueryData(key, { cached: true });
	}
	return queryClient;
}

describe("refreshing pull requests", () => {
	it("reloads every view of one pull request, and nothing else", async () => {
		const queryClient = seed();

		await refreshPullRequest(queryClient, PULL_42);

		const stale = (key: ReturnType<typeof apiRouter.auth.profile.queryKey>): boolean | undefined => queryClient.getQueryState(key)?.isInvalidated;
		expect(stale(apiRouter.githubPullRequests.detail.queryKey(PULL_42))).toBe(true);
		expect(stale(apiRouter.githubPullRequests.files.queryKey({ ...PULL_42, page: 1 }))).toBe(true);
		expect(stale(apiRouter.githubPullRequests.reviewThreads.queryKey(PULL_42))).toBe(true);
		expect(stale(apiRouter.githubPullRequests.detail.queryKey(PULL_7))).toBe(false);
		expect(stale(apiRouter.githubPullRequests.list.queryKey({ filter: "yours", state: "open" }))).toBe(false);
		expect(stale(apiRouter.githubPullRequests.account.queryKey(undefined))).toBe(false);
	});

	it("reloads everything pull-request related after the token changes, and not the rest of the app", async () => {
		const queryClient = seed();

		await refreshAllPullRequests(queryClient);

		expect(queryClient.getQueryState(apiRouter.githubPullRequests.account.queryKey(undefined))?.isInvalidated).toBe(true);
		expect(queryClient.getQueryState(apiRouter.githubPullRequests.list.queryKey({ filter: "yours", state: "open" }))?.isInvalidated).toBe(true);
		expect(queryClient.getQueryState(apiRouter.githubPullRequests.detail.queryKey(PULL_7))?.isInvalidated).toBe(true);
		expect(queryClient.getQueryState(apiRouter.auth.profile.queryKey(undefined))?.isInvalidated).toBe(false);
	});
});
