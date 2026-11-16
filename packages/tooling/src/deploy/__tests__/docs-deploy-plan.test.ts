import { describe, expect, it } from "vitest";

import { DOCS_RELEASES_KEPT, docsLayout, docsReleasesToPrune, isUnsafeArchiveEntry, parseDocsGateCommand } from "../docs-deploy-plan.ts";

const COMMIT = "a".repeat(40);
const SHA256 = "b".repeat(64);

describe("parseDocsGateCommand", () => {
	it("accepts the one command", () => {
		expect(parseDocsGateCommand(`receive ${COMMIT} ${SHA256}`)).toEqual({ kind: "receive", commit: COMMIT, sha256: SHA256 });
	});

	it.each([
		undefined,
		"",
		"receive",
		`receive ${COMMIT}`,
		`receive abc123 ${SHA256}`,
		`receive ${COMMIT} abc123`,
		`receive ${COMMIT} ${SHA256} extra`,
		`deploy ${COMMIT} ${SHA256}`,
		`receive ${COMMIT.toUpperCase()} ${SHA256}`,
		`receive ${COMMIT} ${SHA256}; rm -rf /`,
		"bash -c id",
	])("refuses %j", (original) => {
		expect(parseDocsGateCommand(original).kind).toBe("refused");
	});
});

describe("docsLayout", () => {
	it("keeps everything under the root, apart from the platform's releases", () => {
		const layout = docsLayout("/srv/app");

		expect(layout.release(COMMIT)).toBe(`/srv/app/docs-releases/${COMMIT}`);
		expect(layout.current).toBe("/srv/app/docs-current");
	});
});

describe("docsReleasesToPrune", () => {
	const releases = Array.from({ length: DOCS_RELEASES_KEPT + 3 }, (_item, index) => `/r/${String(index)}`);

	it("keeps the newest releases", () => {
		expect(docsReleasesToPrune(releases, [])).toEqual(releases.slice(DOCS_RELEASES_KEPT));
	});

	it("never prunes the live or last good release, however old", () => {
		const oldest = releases.at(-1) ?? "";

		const pruned = docsReleasesToPrune(releases, [oldest]);

		expect(pruned).not.toContain(oldest);
		expect(pruned).toHaveLength(3);
	});

	it("prunes nothing below the limit", () => {
		expect(docsReleasesToPrune(["/r/1"], ["/r/1"])).toEqual([]);
	});
});

describe("isUnsafeArchiveEntry", () => {
	it.each(["/etc/passwd", "../outside", "a/../../b"])("refuses %s", (entry) => {
		expect(isUnsafeArchiveEntry(entry)).toBe(true);
	});

	it.each(["apps/docs/dist/client/index.html", "a..b/c"])("accepts %s", (entry) => {
		expect(isUnsafeArchiveEntry(entry)).toBe(false);
	});
});
