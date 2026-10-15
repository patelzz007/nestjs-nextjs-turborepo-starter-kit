// ============================================
// github-picture-addresses.ts - The API's own addresses for pictures GitHub shows only to signed-in readers (ADR 052)
// ============================================
// Two kinds of picture in a comment open only for a signed-in reader on
// GitHub: a file kept in a repository (the app's comment pictures, or any
// `github.com/<owner>/<repo>/raw/<ref>/<path>`), and an upload to a private
// repository (GitHub's signed `private-user-images…` link to it expires in
// minutes). The app has no GitHub session, so each is listed with an address
// of the API's (`/github/pictures/…`, `GithubPicturesController`). The address
// names the picture only — no reader, no expiry — so a cached answer never
// carries a dead link: the app opens it signed in as itself, and the API reads
// the picture then, with that reader's own GitHub token, so GitHub still
// decides who sees it.

import { Injectable } from "@nestjs/common";
import { API_VERSION_PREFIX, apiRoutes, GithubRepositoryFileSchema, githubAttachmentIdOf, type GithubRepositoryFile } from "@workspace/shared";
import { z } from "zod";

import { TypedConfigService } from "../../../config/typed-config.service";
import { isSignedUploadLink, type BodyImageLink } from "./github-body-images";

/** `github.com/<owner>/<repo>/raw|blob/<ref>/<path>` — the ref is its first segment, as GitHub reads an ambiguous one. */
const GITHUB_FILE_PATTERN = /^\/(?<owner>[^/]+)\/(?<repository>[^/]+)\/(?:raw|blob)\/(?<ref>[^/]+)\/(?<path>.+)$/u;
/** `raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>`. */
const RAW_FILE_PATTERN = /^\/(?<owner>[^/]+)\/(?<repository>[^/]+)\/(?<ref>[^/]+)\/(?<path>.+)$/u;

const FilePathGroupsSchema = z.object({ owner: z.string(), repository: z.string(), ref: z.string(), path: z.string() });

/** The repository file an image address names, or `null` for any other address. */
export function repositoryFileOf(address: string): GithubRepositoryFile | null {
	const url = z.url({ protocol: /^https$/u }).safeParse(address);
	if (!url.success) {
		return null;
	}
	const { hostname, pathname } = new URL(url.data);
	const pattern = hostname === "github.com" ? GITHUB_FILE_PATTERN : hostname === "raw.githubusercontent.com" ? RAW_FILE_PATTERN : null;
	const groups = FilePathGroupsSchema.safeParse(pattern?.exec(pathname)?.groups);
	if (!groups.success) {
		return null;
	}
	try {
		const file = GithubRepositoryFileSchema.safeParse({
			owner: decodeURIComponent(groups.data.owner),
			repository: decodeURIComponent(groups.data.repository),
			ref: decodeURIComponent(groups.data.ref),
			path: groups.data.path.split("/").map(decodeURIComponent).join("/"),
		});
		return file.success ? file.data : null;
	} catch {
		// A malformed escape (`%E0%A4`) names no file.
		return null;
	}
}

/** The address a comment links a repository file by. */
export function repositoryFileAddress(file: GithubRepositoryFile): string {
	const path = file.path.split("/").map(encodeURIComponent).join("/");
	return `https://github.com/${encodeURIComponent(file.owner)}/${encodeURIComponent(file.repository)}/raw/${encodeURIComponent(file.ref)}/${path}`;
}

@Injectable()
export class GithubPictureAddresses {
	public constructor(private readonly config: TypedConfigService) {}

	/** Where the app loads each picture of a body: the API's address for the two kinds above, GitHub's own for the rest. */
	public readonly linkFor: BodyImageLink = (src: string, nodeId: string): string => {
		const file = repositoryFileOf(src);
		if (file !== null) {
			return this.repositoryFileAddress(file);
		}
		const attachmentId = isSignedUploadLink(src) ? githubAttachmentIdOf(src) : null;
		return attachmentId === null ? src : this.uploadAddress(attachmentId, nodeId);
	};

	private repositoryFileAddress(file: GithubRepositoryFile): string {
		const query = new URLSearchParams({ owner: file.owner, repository: file.repository, ref: file.ref, path: file.path });
		return `${this.config.http.publicUrl}${API_VERSION_PREFIX}${apiRoutes.githubPictures.file}?${query.toString()}`;
	}

	private uploadAddress(attachmentId: string, nodeId: string): string {
		const path = apiRoutes.githubPictures.upload.replace(":attachmentId", encodeURIComponent(attachmentId));
		return `${this.config.http.publicUrl}${API_VERSION_PREFIX}${path}?${new URLSearchParams({ node: nodeId }).toString()}`;
	}
}
