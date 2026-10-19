import { Query } from "@nestjs/cqrs";
import type { GithubAccountStatus } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The caller's GitHub link: `off`, `unlinked` or the linked account — never the token. */
export class GetGithubAccountStatusQuery extends Query<GithubAccountStatus> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
