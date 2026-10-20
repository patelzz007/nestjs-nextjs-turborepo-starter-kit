// ============================================
// github-comment-pictures.ts - Pictures in pull-request comments (ADR 052)
// ============================================
// Attaching: the app uploads a photo through the file pipeline
// (`GITHUB_COMMENT_IMAGE`: size, SHA-256 and type checked, scanned) and asks
// where it will be in the repository; the address is known before anything is
// committed, so the draft links it straight away.
// Committing: only when a comment or review is posted, each picture it links
// that is still the caller's upload is committed with their token, then the
// upload is deleted. A picture taken out of the draft is never committed; its
// upload is deleted by the storage sweep once its category's staging time is up.

import { Inject, Injectable, Logger } from "@nestjs/common";
import { FILE_CATEGORY_POLICIES, type GithubPullRequestParams } from "@workspace/shared";

import { isOwnReadyCommentPicture, linkedPicturesIn, type LinkedPicture } from "../../domain/policies/comment-picture.policy";
import { GithubPictureUnavailableError, GithubWriteRejectedError } from "../errors/github.errors";
import type { CommentPictureUploadsPort } from "../ports/comment-picture-uploads.port";
import type { LinkedGithubCredential } from "../ports/github-credentials.port";
import type { GithubRepositoryFilesPort } from "../ports/github-repository-files.port";
import { COMMENT_PICTURE_UPLOADS, GITHUB_REPOSITORY_FILES } from "../ports/github.tokens";

const COMMENT_PICTURE_POLICY = FILE_CATEGORY_POLICIES.GITHUB_COMMENT_IMAGE;

@Injectable()
export class GithubCommentPictures {
	private readonly logger: Logger = new Logger(GithubCommentPictures.name);

	public constructor(
		@Inject(COMMENT_PICTURE_UPLOADS) private readonly uploads: CommentPictureUploadsPort,
		@Inject(GITHUB_REPOSITORY_FILES) private readonly repositoryFiles: GithubRepositoryFilesPort,
	) {}

	/**
	 * Commits every picture attached from the app that `body` links in this
	 * repository, before the body is posted: the caller's own uploads are
	 * committed (then deleted); one already committed is left as it is. A
	 * linked picture that is neither — its upload gone, never committed — is
	 * refused, so a comment never shows a broken picture.
	 */
	public async commitLinkedPictures(linked: LinkedGithubCredential, userId: string, params: GithubPullRequestParams, body: string): Promise<void> {
		for (const picture of linkedPicturesIn(body, params)) {
			const upload = await this.uploads.find(picture.fileId);
			if (upload !== null && isOwnReadyCommentPicture(upload, userId) && upload.extension === picture.extension) {
				await this.commitUpload(linked, userId, picture);
				continue;
			}
			if (!(await this.repositoryFiles.fileExists(linked, picture.file))) {
				throw new GithubPictureUnavailableError(picture.fileId);
			}
		}
	}

	/**
	 * Commits one upload where its address says. Two posts linking the same new
	 * picture at once both try: GitHub refuses the second (the file is there
	 * now), which is then as good as done.
	 */
	private async commitUpload(linked: LinkedGithubCredential, userId: string, picture: LinkedPicture): Promise<void> {
		const { file } = picture;
		const bytes = await this.uploads.readBytes(picture.fileId, COMMENT_PICTURE_POLICY.maxBytes);
		try {
			await this.repositoryFiles.commitFile(
				linked,
				{ owner: file.owner, repository: file.repository },
				file.path,
				bytes,
				`Add a picture for pull request #${String(picture.number)}`,
			);
		} catch (error: unknown) {
			if (!(error instanceof GithubWriteRejectedError && error.refusal === "unprocessable" && (await this.repositoryFiles.fileExists(linked, file)))) {
				throw error;
			}
		}
		await this.discardUpload(picture.fileId, userId);
	}

	/** The committed copy is the picture now; the upload is deleted. A failure here leaves a private, unused copy — never a broken comment; the sweep removes it. */
	private async discardUpload(fileId: string, userId: string): Promise<void> {
		try {
			await this.uploads.discard(fileId, userId);
		} catch (error: unknown) {
			this.logger.warn(`The uploaded copy of comment picture ${fileId} could not be deleted: ${error instanceof Error ? error.message : "unknown error"}`);
		}
	}
}
