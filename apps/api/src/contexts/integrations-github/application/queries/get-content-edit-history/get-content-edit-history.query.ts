import { Query } from "@nestjs/cqrs";
import type { GithubContentEditHistory, GithubContentEditParams } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Every saved version of a comment, review or description. */
export class GetContentEditHistoryQuery extends Query<GithubContentEditHistory> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GithubContentEditParams,
	) {
		super();
	}
}
