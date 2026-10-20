import { Injectable } from "@nestjs/common";
import type { GithubRepositoryFile, GithubRepositoryParams } from "@workspace/shared";

import type { LinkedGithubCredential } from "../../application/ports/github-credentials.port";
import type { GithubPicture, GithubRepositoryFilesPort } from "../../application/ports/github-repository-files.port";
import { signedUploadLinkIn } from "../github-api/github-body-images";
import { GithubPullRequestClient } from "../github-api/github-pull-request.client";
import { GithubRepositoryFilesClient } from "../github-api/github-repository-files.client";
import { linkedTransportCredential } from "./linked-credential";

/** Comment pictures kept in a repository, and uploads found in GitHub's rendered bodies (ADR 052). */
@Injectable()
export class GithubRepositoryFilesAdapter implements GithubRepositoryFilesPort {
	public constructor(
		private readonly files: GithubRepositoryFilesClient,
		private readonly pullRequests: GithubPullRequestClient,
	) {}

	public async commitFile(linked: LinkedGithubCredential, repository: GithubRepositoryParams, path: string, bytes: Buffer, message: string): Promise<void> {
		await this.files.commitFile(linkedTransportCredential(linked), repository, path, bytes, message);
	}

	public readImage(linked: LinkedGithubCredential, file: GithubRepositoryFile, maxBytes: number): Promise<GithubPicture> {
		return this.files.readImage(linkedTransportCredential(linked), file, maxBytes);
	}

	public readSignedUpload(signedUrl: string, nodeId: string, maxBytes: number): Promise<GithubPicture> {
		return this.files.readSignedUpload(signedUrl, nodeId, maxBytes);
	}

	public fileExists(linked: LinkedGithubCredential, file: GithubRepositoryFile): Promise<boolean> {
		return this.files.fileExists(linkedTransportCredential(linked), file);
	}

	public async findSignedUploadLink(linked: LinkedGithubCredential, nodeId: string, attachmentId: string): Promise<string | null> {
		return signedUploadLinkIn(await this.pullRequests.fetchBodyHtml(linkedTransportCredential(linked), nodeId), attachmentId);
	}
}
