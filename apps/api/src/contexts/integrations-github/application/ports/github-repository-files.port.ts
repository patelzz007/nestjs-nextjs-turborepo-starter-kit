import type { DocumentMimeType, GithubRepositoryFile, GithubRepositoryParams } from "@workspace/shared";

import type { LinkedGithubCredential } from "./github-credentials.port";

/** A picture read from GitHub, checked by its bytes. */
export interface GithubPicture {
	readonly bytes: Buffer;
	readonly mimeType: DocumentMimeType;
}

/** Comment pictures kept in a repository, and uploads shown in a comment body. */
export interface GithubRepositoryFilesPort {
	/** Commits `bytes` at `path` on the comment-assets branch. */
	commitFile(linked: LinkedGithubCredential, repository: GithubRepositoryParams, path: string, bytes: Buffer, message: string): Promise<void>;
	readImage(linked: LinkedGithubCredential, file: GithubRepositoryFile, maxBytes: number): Promise<GithubPicture>;
	readSignedUpload(signedUrl: string, nodeId: string, maxBytes: number): Promise<GithubPicture>;
	fileExists(linked: LinkedGithubCredential, file: GithubRepositoryFile): Promise<boolean>;
	/**
	 * GitHub's fresh signed link to upload `attachmentId` in the rendered body of `nodeId` (a pull
	 * request, comment, review or line comment), read with the caller's token; `null` when the body
	 * does not show it.
	 */
	findSignedUploadLink(linked: LinkedGithubCredential, nodeId: string, attachmentId: string): Promise<string | null>;
}
