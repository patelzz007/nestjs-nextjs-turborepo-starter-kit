// The rules and the root guides name real files (enhancement 7.8): a path in backticks under apps/ or
// packages/ must exist, so a moved file can't leave the agents' and developers' guides pointing at nothing.
// "Exist" means in the repository (tracked, or new and not ignored), never merely on this disk: a developer's
// ignored local file (`apps/api/.env`) once made this pass on a Mac and fail in CI's fresh checkout. A file the
// guides tell you to create from its committed `.example` (`cp apps/api/.env.example apps/api/.env`) counts.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { workingTreeFiles } from "../scripts/lib/working-tree-files.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const PATH_IN_BACKTICKS = /`(?<path>(?:apps|packages)\/[A-Za-z0-9_.@()[\]/-]+)`/gu;
/** Paths a guide names ON PURPOSE without them existing: what the repo does NOT have, and worked examples. */
const ILLUSTRATIONS = new Set(["packages/contracts", "packages/database", "packages/observability", "apps/api/src/contexts/invoices/"]);

const GUIDES = [
	"AGENTS.md",
	"README.md",
	...readdirSync(path.join(REPO_ROOT, "rules"))
		.filter((name) => name.endsWith(".md"))
		.map((name) => `rules/${name}`),
];

/** The suffix of a committed template a guide tells you to copy into place (`.env.example` → `.env`). */
const EXAMPLE_SUFFIX = ".example";

/**
 * Whether `named` is in the repository: one of its files, a folder holding one, or a file made from a committed
 * `<named>.example`.
 * @param {ReadonlySet<string>} files
 * @param {string} named
 */
export function isInRepository(files, named) {
	const bare = named.replace(/\/$/u, "");
	return files.has(bare) || files.has(`${bare}${EXAMPLE_SUFFIX}`) || [...files].some((file) => file.startsWith(`${bare}/`));
}

/**
 * @param {string} guide
 * @param {ReadonlySet<string>} files
 */
function missingPaths(guide, files) {
	const text = readFileSync(path.join(REPO_ROOT, guide), "utf8");
	return (
		[...text.matchAll(PATH_IN_BACKTICKS)]
			.map((match) => match.groups?.path ?? "")
			// A worked example (`apps/web/app/...`) is recognised before the trailing punctuation is trimmed: trimmed
			// first, it became `apps/web/app/..`, which the old on-disk check resolved to the parent folder.
			.filter((named) => !/[*<{]|\.\.\.$/u.test(named))
			.map((named) => named.replace(/[.,:]$/u, ""))
			.filter((named) => !ILLUSTRATIONS.has(named))
			.filter((named) => !isInRepository(files, named))
	);
}

describe("paths named in the guides", () => {
	const files = new Set(workingTreeFiles(REPO_ROOT, ["apps", "packages"]));

	it.each(GUIDES)("%s names only paths that exist", (guide) => {
		expect(missingPaths(guide, files)).toStrictEqual([]);
	});

	it("counts the repository's files and folders, and a file made from its committed .example, never an ignored local file", () => {
		const repository = new Set(["apps/api/.env.example", "apps/api/src/main.ts"]);
		expect(isInRepository(repository, "apps/api/src/main.ts")).toBe(true);
		expect(isInRepository(repository, "apps/api/src")).toBe(true);
		expect(isInRepository(repository, "apps/api/src/")).toBe(true);
		expect(isInRepository(repository, "apps/api/.env")).toBe(true);
		expect(isInRepository(repository, "apps/web/.env")).toBe(false);
		expect(isInRepository(repository, "apps/api/src/gone.ts")).toBe(false);
	});
});
