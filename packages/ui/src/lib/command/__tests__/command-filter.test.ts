import { describe, expect, it } from "vitest";

import {
	COMMAND_SCORE_ALL_WORDS,
	COMMAND_SCORE_CONTAINS,
	COMMAND_SCORE_NONE,
	COMMAND_SCORE_SUBSEQUENCE,
	defaultCommandFilter,
	isSubsequence,
} from "@workspace/ui/lib/command/command-filter";

describe("defaultCommandFilter", () => {
	it("keeps everything for an empty or blank search", () => {
		expect(defaultCommandFilter("Users", "", [])).toBe(COMMAND_SCORE_CONTAINS);
		expect(defaultCommandFilter("Users", "   ", [])).toBe(COMMAND_SCORE_CONTAINS);
	});

	it("matches a substring of the value or a keyword, ignoring case", () => {
		expect(defaultCommandFilter("Audit logs", "LOG", [])).toBe(COMMAND_SCORE_CONTAINS);
		expect(defaultCommandFilter("Users", "people", ["People", "members"])).toBe(COMMAND_SCORE_CONTAINS);
	});

	it("matches every word in any order", () => {
		expect(defaultCommandFilter("Letters of credit", "credit letters", [])).toBe(COMMAND_SCORE_ALL_WORDS);
	});

	it("falls back to the letters in order", () => {
		expect(defaultCommandFilter("Direct messages", "dms", [])).toBe(COMMAND_SCORE_SUBSEQUENCE);
	});

	it("rejects text that does not match", () => {
		expect(defaultCommandFilter("Users", "zebra", [])).toBe(COMMAND_SCORE_NONE);
	});
});

describe("isSubsequence", () => {
	it("finds the needle's characters in order, ignoring its spaces", () => {
		expect(isSubsequence("a c", "abc")).toBe(true);
		expect(isSubsequence("ca", "abc")).toBe(false);
		expect(isSubsequence("", "abc")).toBe(true);
	});
});
