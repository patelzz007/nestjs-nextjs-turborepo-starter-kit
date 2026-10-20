// Pictures attached from the app to a pull-request comment (ADR 052). Each is
// kept at `pull-requests/<number>/<upload id>.<extension>` on the
// comment-assets branch, so its address is known before anything is committed.

import { GITHUB_COMMENT_ASSETS_BRANCH, type GithubRepositoryFile, type GithubRepositoryParams } from "@workspace/shared";
import { z } from "zod";

import { repositoryFileOf } from "./github-picture-address.policy";

/** Where an attached picture is kept: `pull-requests/<number>/<upload id>.<extension>`. */
const PICTURE_PATH_PATTERN = /^pull-requests\/(?<number>[1-9]\d*)\/(?<fileId>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(?<extension>[a-z0-9]+)$/u;

const PicturePathGroupsSchema = z.object({ number: z.coerce.number().int().positive(), fileId: z.string(), extension: z.string() });

/** Every `https://github.com/…` address in a markdown body, up to the first character that cannot be part of one. */
const GITHUB_ADDRESS_PATTERN = /https:\/\/github\.com\/[^\s"'<>()[\]]+/gu;

/** The file category an attachable picture is uploaded under. */
export const COMMENT_PICTURE_CATEGORY = "GITHUB_COMMENT_IMAGE";

/** The upload status a picture must have reached (scanned and ready). */
const READY_STATUS = "READY";

/** One picture attached from the app that a body links. */
export interface LinkedPicture {
	/** The pull request it was attached for. */
	readonly number: number;
	readonly fileId: string;
	readonly extension: string;
	readonly file: GithubRepositoryFile;
}

/** What decides whether an upload may become a comment picture. */
export interface CommentPictureCandidate {
	readonly category: string;
	readonly uploadedById: string | null;
	readonly status: string;
}

/** Where the picture of upload `fileId` is kept for pull request `number`. */
export function commentPicturePath(number: number, fileId: string, extension: string): string {
	return `pull-requests/${String(number)}/${fileId}.${extension}`;
}

/** Only the uploader's own READY `GITHUB_COMMENT_IMAGE` qualifies. */
export function isOwnReadyCommentPicture(upload: CommentPictureCandidate, userId: string): boolean {
	return upload.category === COMMENT_PICTURE_CATEGORY && upload.uploadedById === userId && upload.status === READY_STATUS;
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
