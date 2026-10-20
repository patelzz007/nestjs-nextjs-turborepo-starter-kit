import { apiRouter } from "@workspace/api-client";

import { createTestQueryClient } from "../../../../../test/query-clients";
import { refreshGithubContributions } from "../refresh";

describe("refreshGithubContributions", () => {
	it("marks the repository list and every repository view stale, and nothing else", async () => {
		const queryClient = createTestQueryClient();
		const params = { owner: "patelzz007", repository: "site" };
		const github = [
			apiRouter.github.repositories.queryKey(undefined),
			apiRouter.github.repositorySummary.queryKey(params),
			apiRouter.github.repositoryCommits.queryKey({ ...params, limit: 10 }),
			apiRouter.github.repositoryContributors.queryKey(params),
		];
		const profile = apiRouter.auth.profile.queryKey(undefined);
		for (const key of [...github, profile]) {
			queryClient.setQueryData(key, { cached: true });
		}

		await refreshGithubContributions(queryClient);

		expect(github.map((key) => queryClient.getQueryState(key)?.isInvalidated)).toEqual([true, true, true, true]);
		expect(queryClient.getQueryState(profile)?.isInvalidated).toBe(false);
	});
});
