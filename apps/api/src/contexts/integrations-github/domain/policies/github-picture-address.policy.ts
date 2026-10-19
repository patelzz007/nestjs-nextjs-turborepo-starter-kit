// The addresses a comment links a repository file by (ADR 052): `github.com/<owner>/<repo>/raw|blob/<ref>/<path>`
// or `raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>`. Pure parsing — no reader, no expiry.

import { GithubRepositoryFileSchema, type GithubRepositoryFile } from "@workspace/shared";
import { z } from "zod";

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
