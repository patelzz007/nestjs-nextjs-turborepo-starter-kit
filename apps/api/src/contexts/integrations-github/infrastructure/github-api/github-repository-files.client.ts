// ============================================
// github-repository-files.client.ts - Comment pictures kept in the repository (ADR 052)
// ============================================
// GitHub has no API for its own comment uploads, so a picture attached from
// the app is committed to the pull request's repository, on a branch of its
// own (`GITHUB_COMMENT_ASSETS_BRANCH`, never merged), with the admin's linked
// token — which then needs "Contents: Read and write" there. GitHub shows it
// in the comment to whoever may read the repository, exactly as it decides for
// the code. The reader's own token reads such a file back for the app
// (`readImage`); an upload to a private repository is read through GitHub's
// own signed link to it (`readSignedUpload`).

import { Injectable } from "@nestjs/common";
import { GITHUB_COMMENT_ASSETS_BRANCH, type DocumentMimeType, type GithubRepositoryParams } from "@workspace/shared";

import { GITHUB_REST_API_URL } from "./github.constants";
import {
	GithubContentNotFoundError,
	GithubRepositoryFileNotFoundError,
	GithubWriteRejectedError,
	repositoryFileTarget,
	type GithubReadTarget,
	type GithubRepositoryFileParams,
} from "../../application/errors/github.errors";
import { GithubHttpTransport, type GithubCredential } from "./github-http.transport";
import { detectMimeFromMagicBytes, MAGIC_BYTES_PREFIX_LENGTH } from "../../../../platform/infrastructure/storage/utils/magic-bytes.util";
import { GITHUB_BRANCH_HEAD_QUERY, GITHUB_FILE_EXISTS_QUERY } from "./github-pull-requests.queries";
import {
	GithubBranchHeadResponseWireSchema,
	GithubCommittedFileWireSchema,
	GithubFileExistsResponseWireSchema,
	GithubGitObjectWireSchema,
} from "./github-pull-requests.wire-schemas";

/** A regular, non-executable file in a Git tree. */
const GIT_FILE_MODE = "100644";

/** Picture types served back to the app — never a PDF or anything a browser would run. */
const SERVABLE_IMAGE_TYPES: ReadonlySet<DocumentMimeType> = new Set<DocumentMimeType>(["image/jpeg", "image/png", "image/webp", "image/avif"]);

/** A picture read from a repository. */
export interface RepositoryImage {
	readonly bytes: Buffer;
	readonly mimeType: DocumentMimeType;
}

/** The file is not a picture the app shows (or is larger than it allows). */
export class RepositoryFileNotAnImageError extends GithubRepositoryFileNotFoundError {}

/** The bytes of a picture the app shows, or `null` for anything else or anything larger than `maxBytes` (checked by its bytes, never its headers). */
async function servableImage(response: Response, maxBytes: number): Promise<RepositoryImage | null> {
	const declaredLength = Number(response.headers.get("content-length") ?? "0");
	if (declaredLength > maxBytes) {
		return null;
	}
	const bytes = Buffer.from(await response.arrayBuffer());
	const mimeType = detectMimeFromMagicBytes(bytes.subarray(0, MAGIC_BYTES_PREFIX_LENGTH));
	if (bytes.length > maxBytes || mimeType === null || !SERVABLE_IMAGE_TYPES.has(mimeType)) {
		return null;
	}
	return { bytes, mimeType };
}

function repositoryPath(params: GithubRepositoryParams): string {
	return `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repository)}`;
}

function encodedFilePath(path: string): string {
	return path.split("/").map(encodeURIComponent).join("/");
}

@Injectable()
export class GithubRepositoryFilesClient {
	public constructor(private readonly transport: GithubHttpTransport) {}

	/**
	 * Commits `bytes` at `path` on the comment-assets branch. The first picture
	 * of a repository starts the branch from nothing (a commit with no parent,
	 * so none of the repository's code is copied into it); later ones are added
	 * on top. Two first pictures at once both try to start it: the loser adds
	 * its picture to the winner's branch instead.
	 */
	public async commitFile(
		credential: GithubCredential,
		repository: GithubRepositoryParams,
		path: string,
		bytes: Buffer,
		message: string,
	): Promise<GithubRepositoryFileParams> {
		const file: GithubRepositoryFileParams = { ...repository, ref: GITHUB_COMMENT_ASSETS_BRANCH, path };
		const target = repositoryFileTarget(file);
		if (await this.branchExists(credential, repository, target)) {
			await this.addFile(credential, file, bytes, message, target);
			return file;
		}
		try {
			await this.startBranch(credential, file, bytes, message, target);
		} catch (error: unknown) {
			if (!(error instanceof GithubWriteRejectedError && error.refusal === "unprocessable")) {
				throw error;
			}
			// "Reference already exists": someone started the branch first.
			await this.addFile(credential, file, bytes, message, target);
		}
		return file;
	}

	/**
	 * A picture's bytes, read with the caller's token (so GitHub decides who may
	 * see it). Anything that is not a picture the app shows, or is larger than
	 * `maxBytes`, is answered as not found.
	 */
	public async readImage(credential: GithubCredential, file: GithubRepositoryFileParams, maxBytes: number): Promise<RepositoryImage> {
		const target = repositoryFileTarget(file);
		const query = new URLSearchParams({ ref: file.ref });
		const response = await this.transport.sendRaw(
			credential,
			`${GITHUB_REST_API_URL}${repositoryPath(file)}/contents/${encodedFilePath(file.path)}?${query.toString()}`,
			target,
		);
		const image = await servableImage(response, maxBytes);
		if (image === null) {
			throw new RepositoryFileNotAnImageError(file);
		}
		return image;
	}

	/**
	 * An upload to a private repository, through GitHub's own signed link to it
	 * (read from the body of `nodeId` moments before — the link is the credential
	 * and expires in minutes). Anything that is not a picture the app shows, or is
	 * larger than `maxBytes`, is answered as not found.
	 */
	public async readSignedUpload(signedUrl: string, nodeId: string, maxBytes: number): Promise<RepositoryImage> {
		const target: GithubReadTarget = { kind: "content", nodeId };
		const image = await servableImage(await this.transport.downloadSigned(signedUrl, target), maxBytes);
		if (image === null) {
			throw new GithubContentNotFoundError(nodeId);
		}
		return image;
	}

	/** Whether `file` is on its branch already. */
	public async fileExists(credential: GithubCredential, file: GithubRepositoryFileParams): Promise<boolean> {
		const envelope = await this.transport.graphql(credential, GithubFileExistsResponseWireSchema, GITHUB_FILE_EXISTS_QUERY, repositoryFileTarget(file), {
			owner: file.owner,
			name: file.repository,
			expression: `${file.ref}:${file.path}`,
		});
		return (envelope.data?.repository?.object ?? null) !== null;
	}

	private async branchExists(credential: GithubCredential, repository: GithubRepositoryParams, target: GithubReadTarget): Promise<boolean> {
		const envelope = await this.transport.graphql(credential, GithubBranchHeadResponseWireSchema, GITHUB_BRANCH_HEAD_QUERY, target, {
			owner: repository.owner,
			name: repository.repository,
			ref: `refs/heads/${GITHUB_COMMENT_ASSETS_BRANCH}`,
		});
		const found = envelope.data?.repository;
		if (found === undefined || found === null) {
			throw new GithubRepositoryFileNotFoundError({ ...repository, ref: GITHUB_COMMENT_ASSETS_BRANCH, path: "" });
		}
		return found.ref !== null;
	}

	/** Contents API: one commit adding the file on top of the branch. */
	private async addFile(credential: GithubCredential, file: GithubRepositoryFileParams, bytes: Buffer, message: string, target: GithubReadTarget): Promise<void> {
		const response = await this.transport.put(
			credential,
			`${GITHUB_REST_API_URL}${repositoryPath(file)}/contents/${encodedFilePath(file.path)}`,
			{ message, content: bytes.toString("base64"), branch: file.ref },
			target,
			"Contents",
		);
		await this.transport.parseBody(response, GithubCommittedFileWireSchema, target);
	}

	/** Git data API: a blob, a tree holding only it, a commit without a parent, then the branch pointing at it. */
	private async startBranch(credential: GithubCredential, file: GithubRepositoryFileParams, bytes: Buffer, message: string, target: GithubReadTarget): Promise<void> {
		const git = `${GITHUB_REST_API_URL}${repositoryPath(file)}/git`;
		const blob = await this.createObject(credential, `${git}/blobs`, { content: bytes.toString("base64"), encoding: "base64" }, target);
		const tree = await this.createObject(credential, `${git}/trees`, { tree: [{ path: file.path, mode: GIT_FILE_MODE, type: "blob", sha: blob }] }, target);
		const commit = await this.createObject(credential, `${git}/commits`, { message, tree, parents: [] }, target);
		await this.transport.post(credential, `${git}/refs`, { ref: `refs/heads/${file.ref}`, sha: commit }, target, "Contents");
	}

	private async createObject(credential: GithubCredential, url: string, body: Parameters<GithubHttpTransport["post"]>[2], target: GithubReadTarget): Promise<string> {
		const response = await this.transport.post(credential, url, body, target, "Contents");
		return (await this.transport.parseBody(response, GithubGitObjectWireSchema, target)).sha;
	}
}
