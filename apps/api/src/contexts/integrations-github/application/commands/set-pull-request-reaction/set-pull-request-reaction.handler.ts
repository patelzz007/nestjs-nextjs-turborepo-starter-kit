import { Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { GithubReactionState } from "@workspace/shared";

import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import type { GithubPullRequestCachePort } from "../../ports/github-pull-request-cache.port";
import type { GithubPullRequestWritesPort } from "../../ports/github-pull-requests.port";
import { GITHUB_PULL_REQUEST_CACHE, GITHUB_PULL_REQUEST_WRITES } from "../../ports/github.tokens";
import { SetPullRequestReactionCommand } from "./set-pull-request-reaction.command";

@Injectable()
@CommandHandler(SetPullRequestReactionCommand)
export class SetPullRequestReactionHandler implements ICommandHandler<SetPullRequestReactionCommand, GithubReactionState> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_PULL_REQUEST_WRITES) private readonly writes: GithubPullRequestWritesPort,
		@Inject(GITHUB_PULL_REQUEST_CACHE) private readonly cache: GithubPullRequestCachePort,
	) {}

	public async execute(command: SetPullRequestReactionCommand): Promise<GithubReactionState> {
		const { actor, input } = command;
		const { subject, content, reacted } = input.reaction;
		await this.credentials.withCredential(actor, (linked): Promise<void> => this.writes.setReaction(linked, input.params, subject, content, reacted));
		this.cache.invalidatePullRequest(input.params.owner, input.params.repository, input.params.number);
		return { subject, content, reacted };
	}
}
