import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";

import type { GithubPicture, GithubRepositoryFilesPort } from "../../ports/github-repository-files.port";
import { GITHUB_REPOSITORY_FILES } from "../../ports/github.tokens";
import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import { githubPictureNotFound } from "../../errors/github.errors";
import { GITHUB_SERVED_PICTURE_MAX_BYTES, GetUploadedPictureQuery } from "./get-uploaded-picture.query";

@Injectable()
@QueryHandler(GetUploadedPictureQuery)
export class GetUploadedPictureHandler implements IQueryHandler<GetUploadedPictureQuery, GithubPicture> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_REPOSITORY_FILES) private readonly repositoryFiles: GithubRepositoryFilesPort,
	) {}

	public async execute(query: GetUploadedPictureQuery): Promise<GithubPicture> {
		return this.credentials.withCredential(query.actor, async (linked): Promise<GithubPicture> => {
			const signedLink = await this.repositoryFiles.findSignedUploadLink(linked, query.input.nodeId, query.input.attachmentId);
			if (signedLink === null) {
				throw githubPictureNotFound();
			}
			return this.repositoryFiles.readSignedUpload(signedLink, query.input.nodeId, GITHUB_SERVED_PICTURE_MAX_BYTES);
		});
	}
}
