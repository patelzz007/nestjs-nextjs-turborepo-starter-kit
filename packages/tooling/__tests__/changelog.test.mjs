import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const CHANGELOG = readFileSync(path.join(REPO_ROOT, "blog/changelog.md"), "utf8");
const RELEASE_HEADING = /^## \[(?<version>\d+\.\d+\.\d+)\] — (?<date>\d{4}-\d{2}-\d{2})$/gmu;

/** The released versions, newest first, as the changelog lists them. */
function releases() {
	return [...CHANGELOG.matchAll(RELEASE_HEADING)].map((match) => ({ version: match.groups?.version ?? "", date: match.groups?.date ?? "" }));
}

/** @param {string} version */
function parts(version) {
	return version.split(".").map(Number);
}

describe("the changelog (blog/changelog.md)", () => {
	it("starts with an Unreleased section, then releases", () => {
		const unreleased = CHANGELOG.indexOf("## [Unreleased]");
		expect(unreleased).toBeGreaterThan(0);
		expect(unreleased).toBeLessThan(CHANGELOG.search(RELEASE_HEADING));
		expect(releases().length).toBeGreaterThan(0);
	});

	it("lists releases newest first: versions and dates both descending", () => {
		const list = releases();
		for (const [index, release] of list.entries()) {
			const older = list[index + 1];
			if (older !== undefined) {
				const [major, minor, patch] = parts(release.version);
				const [oldMajor, oldMinor, oldPatch] = parts(older.version);
				expect(major * 1e6 + minor * 1e3 + patch).toBeGreaterThan(oldMajor * 1e6 + oldMinor * 1e3 + oldPatch);
				expect(release.date >= older.date).toBe(true);
			}
		}
	});

	it("matches the root package.json version to the newest release", () => {
		const [newest] = releases();
		expect(JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")).version).toBe(newest?.version);
	});

	it("is shown in the blog, and the root CHANGELOG.md points to it", () => {
		expect(JSON.parse(readFileSync(path.join(REPO_ROOT, "blog/meta.json"), "utf8")).pages).toContain("changelog");
		expect(readFileSync(path.join(REPO_ROOT, "CHANGELOG.md"), "utf8")).toContain("blog/changelog.md");
	});
});
