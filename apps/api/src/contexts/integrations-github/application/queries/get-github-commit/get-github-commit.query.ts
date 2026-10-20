import { Query } from "@nestjs/cqrs";
import type { GithubCommitDetail, GithubCommitParams } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One commit of a listed repository with its diffs. */
export class GetGithubCommitQuery extends Query<GithubCommitDetail> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GithubCommitParams,
	) {
		super();
	}
}
