import { describe, expect, it } from "vitest";

import { shouldDeleteMergedBranch } from "../merge-branch.policy";

describe("shouldDeleteMergedBranch", () => {
	it.each<[boolean, boolean, boolean]>([
		[true, false, true],
		[true, true, false],
		[false, false, false],
		[false, true, false],
	])("asked %s, fork %s → delete %s", (asked, fork, expected) => {
		expect(shouldDeleteMergedBranch(asked, fork)).toBe(expected);
	});
});
