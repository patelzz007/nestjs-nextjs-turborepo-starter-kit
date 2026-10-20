import { Command } from "@nestjs/cqrs";
import type { GithubPullRequestParams, GithubReactionState, SetGithubReactionInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The pull request and what to write on it. */
export interface SetPullRequestReactionInput {
	readonly params: GithubPullRequestParams;
	readonly reaction: SetGithubReactionInput;
}

/** Sets the caller's reaction on or off on GitHub, as their account; setting it to what it already is changes nothing, so no Idempotency-Key is needed. Drops the cached views. */
export class SetPullRequestReactionCommand extends Command<GithubReactionState> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: SetPullRequestReactionInput,
	) {
		super();
	}
}
