// Reloading the GitHub section (Profile's pull-to-refresh). Every GitHub query
// key is nested under the repository list's scope (the api-client router), so
// invalidating that one scope reloads the list and every repository view. The
// API still serves its own cached answers for up to GITHUB_CACHE_TTL_MS.

import { apiRouter } from "@workspace/api-client";
import type { QueryClient } from "@tanstack/react-query";

export async function refreshGithubContributions(queryClient: QueryClient): Promise<void> {
	await queryClient.invalidateQueries({ queryKey: apiRouter.github.repositories.scopeKey(undefined) });
}
