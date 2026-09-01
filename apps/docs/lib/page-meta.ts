import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import type { StructuredData } from "fumadocs-core/mdx-plugins/remark-structure";

/**
 * Git/build-time metadata helpers — used by the docs page route to show a
 * git-derived "last updated" date and a reading-time estimate.
 *
 * Both are computed at build time (SSG), so they cost nothing per request:
 * `getGitLastModified` shells out to `git log` once per page during the build,
 * and the reading time is a word count over the page's structured data.
 */

// `process.cwd()` is the app directory during `next build` / `next start`;
// walking up finds the git root (where `.git` lives) without bundling any
// `new URL(..., import.meta.url)` expressions (Next forbids those outside the
// app dir).
const REPO_ROOT: string = findRepoRoot(process.cwd());
const DOCS_DIR: string = join(REPO_ROOT, "docs");

/** Walks up from `start` until a directory containing `.git` is found. */
function findRepoRoot(start: string): string {
	let current: string = start;
	for (;;) {
		if (existsSync(join(current, ".git"))) {
			return current;
		}
		const parent: string = dirname(current);
		if (parent === current) {
			return start;
		}
		current = parent;
	}
}

/** Resolves the loader's virtual page path to an absolute file path. */
export function docsFilePath(virtualPath: string): string {
	return join(DOCS_DIR, virtualPath.replace(/^docs\//, ""));
}

/**
 * Last commit time (epoch-ms) of the page file, from `git log`. Returns
 * `undefined` when git is unavailable or the file is untracked — callers fall
 * back to the frontmatter `lastUpdated`.
 *
 * Results are memoized: the same page is rendered by multiple build workers and
 * across SSG retries, so the `git` subprocess only ever runs once per file.
 */
const gitModifiedCache = new Map<string, number | undefined>();

export function getGitLastModified(virtualPath: string): number | undefined {
	const filePath: string = docsFilePath(virtualPath);
	if (gitModifiedCache.has(filePath)) {
		return gitModifiedCache.get(filePath);
	}
	let result: number | undefined;
	try {
		const raw: string = execFileSync("git", ["log", "-1", "--format=%ct", "--", filePath], {
			cwd: REPO_ROOT,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		const epochSeconds = Number(raw);
		result = Number.isFinite(epochSeconds) && epochSeconds > 0 ? epochSeconds * 1000 : undefined;
	} catch {
		result = undefined;
	}
	gitModifiedCache.set(filePath, result);
	return result;
}

const WORDS_PER_MINUTE = 200;

/**
 * Rough reading time (minutes) for a page, derived from its structured data
 * (heading + body text). Falls back to the frontmatter description when there
 * is no structured data. Always at least 1 minute.
 */
export function getReadingTime(structuredData: StructuredData | (() => StructuredData) | undefined, fallback: string | undefined): number {
	const data: StructuredData | undefined = typeof structuredData === "function" ? structuredData() : structuredData;
	const raw: string = data !== undefined ? data.contents.map((block) => block.content).join(" ") : (fallback ?? "");
	const words: number = raw
		.replace(/[#>*`_~[\](),!|{}<>\\/=-]/g, " ")
		.split(/\s+/)
		.filter((part) => part.length > 0).length;
	return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
