import path from "node:path";

import { toolingConfig } from "../../../../tooling.config.ts";

/**
 * The rules of the docs deploy (plan §10, ADR 084), kept apart from the gate so each is tested. The Droplet receives a
 * build that already passed CI: it has no checkout and no repository credential.
 */

const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

/** The compressed upload. A release measured 681 MB unpacked on 2026-11-07, mostly production dependencies. Above this, something is wrong. */
export const MAX_DOCS_RELEASE_BYTES = 1024 * 1024 * 1024;
/**
 * Plan §10 assumed 73 MB a release and kept 20. Measured with its dependencies a release is 681 MB, so 20 would hold
 * about 13 GB of the Droplet's disk; 5 holds about 3.4 GB and still leaves several rollback points.
 */
export const DOCS_RELEASES_KEPT = 5;
/** What a release must hold before it may go live. */
export const DOCS_RELEASE_FILES: readonly string[] = [
	`${toolingConfig.folders.docs}/dist/client/index.html`,
	`${toolingConfig.folders.docs}/dist/client/release.json`,
	`${toolingConfig.folders.docs}/dist/server/server.js`,
	`${toolingConfig.folders.docs}/scripts/serve.ts`,
	"ecosystem.config.cjs",
];
export const DOCS_PORT: number = toolingConfig.ports.docs;
export const DOCS_HEALTH_PATHS: readonly string[] = ["/", "/search-index.json"];
export const DOCS_RELEASE_INFO_PATH = "/release.json";

export type DocsGateCommand = { readonly kind: "receive"; readonly commit: string; readonly sha256: string } | { readonly kind: "refused"; readonly reason: string };

/** The one command the deploy key may run: `receive <full commit> <sha256>`. Anything else is refused. */
export function parseDocsGateCommand(original: string | undefined): DocsGateCommand {
	const words = (original ?? "")
		.trim()
		.split(/\s+/u)
		.filter((word) => word.length > 0);
	const [verb, commit, sha256, ...rest] = words;
	if (verb === "receive" && commit !== undefined && sha256 !== undefined && rest.length === 0 && COMMIT_PATTERN.test(commit) && SHA256_PATTERN.test(sha256)) {
		return { kind: "receive", commit, sha256 };
	}
	return { kind: "refused", reason: "expected `receive <full commit sha> <sha256>`" };
}

export interface DocsLayout {
	readonly releases: string;
	readonly current: string;
	readonly lock: string;
	readonly lastGood: string;
	readonly release: (commit: string) => string;
}

export function docsLayout(root: string): DocsLayout {
	const releases = path.join(root, "docs-releases");
	return {
		releases,
		current: path.join(root, "docs-current"),
		lock: path.join(root, "docs-deploy.lock"),
		lastGood: path.join(root, "docs-last-good"),
		release: (commit: string): string => path.join(releases, commit),
	};
}

/** Oldest releases past the limit, never the live one or the last good one. `releases` is newest first. */
export function docsReleasesToPrune(releases: readonly string[], protectedReleases: readonly string[]): readonly string[] {
	const candidates = releases.filter((release) => !protectedReleases.includes(release));
	return candidates.slice(Math.max(DOCS_RELEASES_KEPT - protectedReleases.length, 0));
}

/** A file in the archive that would land outside the release: an absolute path or a parent step. */
export function isUnsafeArchiveEntry(entry: string): boolean {
	return path.isAbsolute(entry) || entry.split("/").includes("..");
}
