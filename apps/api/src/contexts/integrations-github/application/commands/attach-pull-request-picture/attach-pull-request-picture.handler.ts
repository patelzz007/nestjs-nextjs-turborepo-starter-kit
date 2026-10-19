import { Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { GITHUB_COMMENT_ASSETS_BRANCH, type GithubCommentPicture } from "@workspace/shared";

import { commentPicturePath, isOwnReadyCommentPicture } from "../../../domain/policies/comment-picture.policy";
import { repositoryFileAddress } from "../../../domain/policies/github-picture-address.policy";
import { githubPictureNotFound } from "../../errors/github.errors";
import { githubUserIdOf } from "../../github-user-actor";
import type { CommentPictureUploadsPort } from "../../ports/comment-picture-uploads.port";
import { COMMENT_PICTURE_UPLOADS } from "../../ports/github.tokens";
import { AttachPullRequestPictureCommand } from "./attach-pull-request-picture.command";

@Injectable()
@CommandHandler(AttachPullRequestPictureCommand)
export class AttachPullRequestPictureHandler implements ICommandHandler<AttachPullRequestPictureCommand, GithubCommentPicture> {
	public constructor(@Inject(COMMENT_PICTURE_UPLOADS) private readonly uploads: CommentPictureUploadsPort) {}

	public async execute(command: AttachPullRequestPictureCommand): Promise<GithubCommentPicture> {
		const { actor, input } = command;
		const upload = await this.uploads.find(input.picture.fileId);
		if (upload === null || !isOwnReadyCommentPicture(upload, githubUserIdOf(actor))) {
			throw githubPictureNotFound();
		}
		const path = commentPicturePath(input.params.number, upload.id, upload.extension);
		return { url: repositoryFileAddress({ owner: input.params.owner, repository: input.params.repository, ref: GITHUB_COMMENT_ASSETS_BRANCH, path }), path };
	}
}
