import { Query } from "@nestjs/cqrs";
import type { GithubRepositoryList } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The repositories the API may read with the server's token. */
export class ListGithubRepositoriesQuery extends Query<GithubRepositoryList> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
