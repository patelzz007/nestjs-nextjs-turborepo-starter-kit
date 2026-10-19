import { Command } from "@nestjs/cqrs";
import type { AttachGithubCommentPictureInput, GithubCommentPicture, GithubPullRequestParams } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The pull request and what to write on it. */
export interface AttachPullRequestPictureInput {
	readonly params: GithubPullRequestParams;
	readonly picture: AttachGithubCommentPictureInput;
}

/** Where the caller's uploaded picture will be once a comment linking it is posted — nothing is committed yet. Only the uploader's own READY `GITHUB_COMMENT_IMAGE` qualifies; anything else is "not found". */
export class AttachPullRequestPictureCommand extends Command<GithubCommentPicture> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AttachPullRequestPictureInput,
	) {
		super();
	}
}
