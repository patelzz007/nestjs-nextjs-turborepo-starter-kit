// ============================================
// github-comment-pictures.service.ts - Pictures in pull-request comments (ADR 052)
// ============================================
// Attaching: the app uploads a photo through the file pipeline
// (`GITHUB_COMMENT_IMAGE`: size, SHA-256 and type checked, scanned) and asks
// where it will be in the repository; the address is known before anything is
// committed (`pull-requests/<number>/<upload id>.<extension>` on the
// comment-assets branch), so the draft links it straight away.
// Committing: only when a comment or review is posted, each picture it links
// that is still the caller's upload is committed with their token, then the
// upload is deleted. A picture taken out of the draft is never committed; its
// upload is deleted by the storage sweep once its category's staging time is up.
// Serving: the app opens the API's own address for a picture GitHub shows only
// to signed-in readers (`GithubPictureAddresses`); it is read then, with the
// caller's own token.

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { StoredFile } from "@prisma/client";
import {
	FILE_CATEGORY_POLICIES,
	GITHUB_COMMENT_ASSETS_BRANCH,
	type AttachGithubCommentPictureInput,
	type GithubCommentPicture,
	type GithubPullRequestParams,
	type GithubRepositoryFile,
	type GithubRepositoryParams,
} from "@workspace/shared";
import { z } from "zod";

import { FileService } from "../../files/services/file.service";
import { extensionForMimeType } from "../../storage/utils/file-path.util";
import { GithubPictureUnavailableError, GithubWriteRejectedError } from "../github.errors";
import type { GithubCredential } from "../github-http.transport";
import { signedUploadLinkIn } from "./github-body-images";
import { GithubCredentialsService } from "./github-credentials.service";
import { GithubPullRequestClient } from "./github-pull-request.client";
import { repositoryFileAddress, repositoryFileOf } from "./github-picture-addresses";
import { GithubRepositoryFilesClient, type RepositoryImage } from "./github-repository-files.client";

/** Largest picture served back to the app — a repository may hold a bigger file, which is then not shown. */
export const GITHUB_SERVED_PICTURE_MAX_BYTES = 26_214_400;

const COMMENT_PICTURE_POLICY = FILE_CATEGORY_POLICIES.GITHUB_COMMENT_IMAGE;

/** Where an attached picture is kept: `pull-requests/<number>/<upload id>.<extension>`. */
const PICTURE_PATH_PATTERN = /^pull-requests\/(?<number>[1-9]\d*)\/(?<fileId>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(?<extension>[a-z0-9]+)$/u;

const PicturePathGroupsSchema = z.object({ number: z.coerce.number().int().positive(), fileId: z.string(), extension: z.string() });

/** Every `https://github.com/…` address in a markdown body, up to the first character that cannot be part of one. */
const GITHUB_ADDRESS_PATTERN = /https:\/\/github\.com\/[^\s"'<>()[\]]+/gu;

/** One picture attached from the app that a body links. */
interface LinkedPicture {
	/** The pull request it was attached for. */
	readonly number: number;
	readonly fileId: string;
	readonly extension: string;
	readonly file: GithubRepositoryFile;
}

function pictureNotFound(): NotFoundException {
	return new NotFoundException({ message: "Picture not found", error: "FILE_NOT_FOUND" });
}

function picturePathOf(number: number, upload: StoredFile): string {
	return `pull-requests/${String(number)}/${upload.id}.${extensionForMimeType(upload.mimeType)}`;
}

function sameRepository(file: GithubRepositoryFile, repository: GithubRepositoryParams): boolean {
	return file.owner.toLowerCase() === repository.owner.toLowerCase() && file.repository.toLowerCase() === repository.repository.toLowerCase();
}

/** The pictures attached from the app that `body` links in `repository`, each once. */
export function linkedPicturesIn(body: string, repository: GithubRepositoryParams): LinkedPicture[] {
	const pictures = new Map<string, LinkedPicture>();
	for (const [address] of body.matchAll(GITHUB_ADDRESS_PATTERN)) {
		const file = repositoryFileOf(address);
		if (file?.ref !== GITHUB_COMMENT_ASSETS_BRANCH || !sameRepository(file, repository)) {
			continue;
		}
		const groups = PicturePathGroupsSchema.safeParse(PICTURE_PATH_PATTERN.exec(file.path)?.groups);
		if (groups.success && !pictures.has(groups.data.fileId)) {
			pictures.set(groups.data.fileId, { ...groups.data, file });
		}
	}
	return [...pictures.values()];
}

@Injectable()
export class GithubCommentPicturesService {
	private readonly logger: Logger = new Logger(GithubCommentPicturesService.name);

	public constructor(
		private readonly files: FileService,
		private readonly credentials: GithubCredentialsService,
		private readonly repositoryFiles: GithubRepositoryFilesClient,
		private readonly pullRequests: GithubPullRequestClient,
	) {}

	/**
	 * Where the caller's uploaded picture will be once a comment linking it is
	 * posted — nothing is committed yet. Only the uploader's own READY
	 * `GITHUB_COMMENT_IMAGE` qualifies; anything else is "not found".
	 */
	public async attach(userId: string, params: GithubPullRequestParams, input: AttachGithubCommentPictureInput): Promise<GithubCommentPicture> {
		const upload = await this.files.findFile(input.fileId);
		if (upload === null || !this.isOwnReadyUpload(upload, userId)) {
			throw pictureNotFound();
		}
		const path = picturePathOf(params.number, upload);
		return { url: repositoryFileAddress({ owner: params.owner, repository: params.repository, ref: GITHUB_COMMENT_ASSETS_BRANCH, path }), path };
	}

	/**
	 * Commits every picture attached from the app that `body` links in this
	 * repository, before the body is posted: the caller's own uploads are
	 * committed (then deleted); one already committed is left as it is. A
	 * linked picture that is neither — its upload gone, never committed — is
	 * refused, so a comment never shows a broken picture.
	 */
	public async commitLinkedPictures(credential: GithubCredential, userId: string, params: GithubPullRequestParams, body: string): Promise<void> {
		for (const picture of linkedPicturesIn(body, params)) {
			const upload = await this.files.findFile(picture.fileId);
			if (upload !== null && this.isOwnReadyUpload(upload, userId) && extensionForMimeType(upload.mimeType) === picture.extension) {
				await this.commitUpload(credential, userId, picture, upload);
				continue;
			}
			if (!(await this.repositoryFiles.fileExists(credential, picture.file))) {
				throw new GithubPictureUnavailableError(picture.fileId);
			}
		}
	}

	/** A picture kept in a repository, read with the caller's own token. */
	public async repositoryPicture(userId: string, file: GithubRepositoryFile): Promise<RepositoryImage> {
		return this.credentials.withCredential(userId, ({ credential }) => this.repositoryFiles.readImage(credential, file, GITHUB_SERVED_PICTURE_MAX_BYTES));
	}

	/**
	 * An upload to a private repository, shown in the body of `nodeId`: the
	 * body is read now with the caller's token — so GitHub decides they may see
	 * it, and signs a fresh link to the upload — and the picture through that link.
	 */
	public async uploadedPicture(userId: string, attachmentId: string, nodeId: string): Promise<RepositoryImage> {
		return this.credentials.withCredential(userId, async ({ credential }) => {
			const signedLink = signedUploadLinkIn(await this.pullRequests.fetchBodyHtml(credential, nodeId), attachmentId);
			if (signedLink === null) {
				throw pictureNotFound();
			}
			return this.repositoryFiles.readSignedUpload(signedLink, nodeId, GITHUB_SERVED_PICTURE_MAX_BYTES);
		});
	}

	private isOwnReadyUpload(upload: StoredFile, userId: string): boolean {
		return upload.category === "GITHUB_COMMENT_IMAGE" && upload.uploadedById === userId && upload.status === "READY";
	}

	/**
	 * Commits one upload where its address says. Two posts linking the same new
	 * picture at once both try: GitHub refuses the second (the file is there
	 * now), which is then as good as done.
	 */
	private async commitUpload(credential: GithubCredential, userId: string, picture: LinkedPicture, upload: StoredFile): Promise<void> {
		const { file } = picture;
		const bytes = await this.files.readStoredBytes(upload, COMMENT_PICTURE_POLICY.maxBytes);
		try {
			await this.repositoryFiles.commitFile(
				credential,
				{ owner: file.owner, repository: file.repository },
				file.path,
				bytes,
				`Add a picture for pull request #${String(picture.number)}`,
			);
		} catch (error: unknown) {
			if (!(error instanceof GithubWriteRejectedError && error.refusal === "unprocessable" && (await this.repositoryFiles.fileExists(credential, file)))) {
				throw error;
			}
		}
		await this.discardUpload(upload, userId);
	}

	/** The committed copy is the picture now; the upload is deleted. A failure here leaves a private, unused copy — never a broken comment; the sweep removes it. */
	private async discardUpload(upload: StoredFile, userId: string): Promise<void> {
		try {
			await this.files.deleteStoredFile(upload, userId);
		} catch (error: unknown) {
			this.logger.warn(`The uploaded copy of comment picture ${upload.id} could not be deleted: ${error instanceof Error ? error.message : "unknown error"}`);
		}
	}
}
