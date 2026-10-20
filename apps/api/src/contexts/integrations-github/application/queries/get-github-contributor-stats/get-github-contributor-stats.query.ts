import { Query } from "@nestjs/cqrs";
import type { GithubContributorStats, GithubRepositoryParams } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Per-contributor totals of a listed repository. */
export class GetGithubContributorStatsQuery extends Query<GithubContributorStats> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GithubRepositoryParams,
	) {
		super();
	}
}
