// The rules and the root guides name real files (enhancement 7.8): a path in backticks under apps/ or
// packages/ must exist, so a moved file can't leave the agents' and developers' guides pointing at nothing.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

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

/** @param {string} guide */
function missingPaths(guide) {
	const text = readFileSync(path.join(REPO_ROOT, guide), "utf8");
	return [...text.matchAll(PATH_IN_BACKTICKS)]
		.map((match) => (match.groups?.path ?? "").replace(/[.,:]$/u, ""))
		.filter((named) => !/[*<{]|\.\.\.$/u.test(named) && !ILLUSTRATIONS.has(named))
		.filter((named) => !existsSync(path.join(REPO_ROOT, named)));
}

describe("paths named in the guides", () => {
	it.each(GUIDES)("%s names only paths that exist", (guide) => {
		expect(missingPaths(guide)).toStrictEqual([]);
	});
});
