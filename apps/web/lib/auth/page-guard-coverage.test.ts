// Every page the proxy treats as signed-in only must also guard itself on the
// server (lib/auth/page-guard.ts), so a page stays protected even if the proxy's
// matcher or route list stops covering it. Read from disk: a new protected page
// without the guard fails here.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { isWebProtectedPath } from "@/lib/auth/routes";
import { listAppPageFiles } from "@/test-support/app-routes";

/** A dynamic `[id]` segment, replaced by a sample value to build a concrete path. */
const DYNAMIC_SEGMENT_PATTERN = /^\[.+\]$/;
const SAMPLE_SEGMENT_VALUE = "sample";

/** The guard call every protected page makes before fetching or rendering. */
const GUARD_CALL = /\bawait guardWebPage\(/;

function concretePath(segments: readonly string[]): string {
	return `/${segments.map((segment) => (DYNAMIC_SEGMENT_PATTERN.test(segment) ? SAMPLE_SEGMENT_VALUE : segment)).join("/")}`;
}

const PROTECTED_PAGES = listAppPageFiles().filter((page) => isWebProtectedPath(concretePath(page.segments)));

describe("server page guard coverage", () => {
	it("finds the signed-in pages (sanity check of the scan)", () => {
		expect(PROTECTED_PAGES.map((page) => concretePath(page.segments))).toEqual(
			expect.arrayContaining([
				"/rewardhub",
				"/rewardhub/wallet",
				"/rewardhub/wallet/sample",
				"/rewardhub/activity",
				"/rewardhub/account",
				"/rewardhub/rewards/sample",
				"/hello",
			]),
		);
	});

	it.each(PROTECTED_PAGES.map((page) => [concretePath(page.segments), page.file]))("%s calls guardWebPage", (_path: string, file: string) => {
		expect(readFileSync(file, "utf8")).toMatch(GUARD_CALL);
	});
});
