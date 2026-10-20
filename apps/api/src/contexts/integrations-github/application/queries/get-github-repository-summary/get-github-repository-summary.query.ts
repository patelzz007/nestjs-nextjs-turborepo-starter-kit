import { Query } from "@nestjs/cqrs";
import type { GithubRepositoryParams, GithubRepositorySummary } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Summary of a listed repository. */
export class GetGithubRepositorySummaryQuery extends Query<GithubRepositorySummary> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GithubRepositoryParams,
	) {
		super();
	}
}
