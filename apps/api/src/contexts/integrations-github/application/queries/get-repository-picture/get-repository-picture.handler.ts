import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";

import type { GithubPicture, GithubRepositoryFilesPort } from "../../ports/github-repository-files.port";
import { GITHUB_REPOSITORY_FILES } from "../../ports/github.tokens";
import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import { GITHUB_SERVED_PICTURE_MAX_BYTES } from "../get-uploaded-picture/get-uploaded-picture.query";
import { GetRepositoryPictureQuery } from "./get-repository-picture.query";

@Injectable()
@QueryHandler(GetRepositoryPictureQuery)
export class GetRepositoryPictureHandler implements IQueryHandler<GetRepositoryPictureQuery, GithubPicture> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_REPOSITORY_FILES) private readonly repositoryFiles: GithubRepositoryFilesPort,
	) {}

	public execute(query: GetRepositoryPictureQuery): Promise<GithubPicture> {
		return this.credentials.withCredential(query.actor, (linked) => this.repositoryFiles.readImage(linked, query.input, GITHUB_SERVED_PICTURE_MAX_BYTES));
	}
}
