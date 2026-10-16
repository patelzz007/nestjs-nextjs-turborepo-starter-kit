import { GithubCommitDetailSchema, type GithubCommitFile } from "@workspace/shared";

import { GITHUB_COMMIT_PATCH, githubCommitDetailJson } from "../../../../test/fixtures";
import { COMMIT_AUTO_EXPAND_LINES, DIFF_STAT_SQUARES, FILE_AUTO_EXPAND_LINES, diffLineCount, diffStatBlocks, initiallyExpandedPaths, parsePatch } from "../diff";

/** A file whose diff has exactly `lines` lines. */
function fileWithLines(path: string, lines: number): GithubCommitFile {
	const patch = ["@@ -1 +1 @@", ...Array.from({ length: lines - 1 }, (_entry: undefined, position: number): string => `+line ${String(position)}`)].join("\n");
	return { path, previousPath: null, status: "modified", additions: lines - 1, deletions: 0, diff: { kind: "patch", patch } };
}

function fileWithoutDiff(path: string): GithubCommitFile {
	return { path, previousPath: null, status: "added", additions: 0, deletions: 0, diff: { kind: "unavailable" } };
}

describe("parsePatch", () => {
	it("numbers each line in the old and the new file from the hunk header", () => {
		expect(parsePatch(GITHUB_COMMIT_PATCH)).toEqual([
			{ key: "hunk:1:1", kind: "hunk", oldNumber: null, newNumber: null, text: "@@ -1,3 +1,4 @@ export function app() {" },
			{ key: "=:1:1", kind: "context", oldNumber: 1, newNumber: 1, text: 'import { a } from "./a";' },
			{ key: "-:2", kind: "deletion", oldNumber: 2, newNumber: null, text: "const b = 1;" },
			{ key: "+:2", kind: "addition", oldNumber: null, newNumber: 2, text: "const b = 2;" },
			{ key: "+:3", kind: "addition", oldNumber: null, newNumber: 3, text: "const c = 3;" },
			{ key: "=:3:4", kind: "context", oldNumber: 3, newNumber: 4, text: "export default a;" },
		]);
	});

	it("restarts the numbers at each hunk", () => {
		const lines = parsePatch("@@ -1,2 +1,2 @@\n-a\n+b\n@@ -40,3 +40,2 @@ section\n x\n-y\n z");

		expect(lines.map((line) => [line.kind, line.oldNumber, line.newNumber])).toEqual([
			["hunk", null, null],
			["deletion", 1, null],
			["addition", null, 1],
			["hunk", null, null],
			["context", 40, 40],
			["deletion", 41, null],
			["context", 42, 41],
		]);
	});

	it("reads a hunk header without line counts (a one-line file)", () => {
		expect(parsePatch("@@ -0,0 +1 @@\n+only line").at(-1)).toMatchObject({ kind: "addition", newNumber: 1 });
	});

	it("shows git's no-newline note as a note after the line it is about, without its marker", () => {
		const lines = parsePatch("@@ -1 +1 @@\n-a\n\\ No newline at end of file\n+b\n\\ No newline at end of file");

		expect(lines.filter((line) => line.kind === "note")).toEqual([
			{ key: "note:-:1", kind: "note", oldNumber: null, newNumber: null, text: "No newline at end of file" },
			{ key: "note:+:1", kind: "note", oldNumber: null, newNumber: null, text: "No newline at end of file" },
		]);
	});

	it("keeps empty lines of the file, but not the patch's trailing line break", () => {
		const lines = parsePatch("@@ -1,2 +1,2 @@\n \n-a\n");

		expect(lines.map((line) => [line.kind, line.text])).toEqual([
			["hunk", "@@ -1,2 +1,2 @@"],
			["context", ""],
			["deletion", "a"],
		]);
	});

	it("gives every line a distinct key", () => {
		const keys = parsePatch("@@ -1,3 +1,3 @@\n a\n-b\n+c\n d\n@@ -10 +10 @@\n-e\n+f").map((line) => line.key);

		expect(new Set(keys).size).toBe(keys.length);
	});
});

describe("diffStatBlocks", () => {
	it.each([
		["no change", 0, 0, { added: 0, deleted: 0, unchanged: 5 }],
		["one square per line for a small change", 2, 1, { added: 2, deleted: 1, unchanged: 2 }],
		["only additions", 120, 0, { added: 5, deleted: 0, unchanged: 0 }],
		["only deletions", 0, 40, { added: 0, deleted: 5, unchanged: 0 }],
		["a split by share", 60, 40, { added: 3, deleted: 2, unchanged: 0 }],
		["at least one square for a small side", 1_000, 1, { added: 4, deleted: 1, unchanged: 0 }],
		["at least one square for few additions", 1, 1_000, { added: 1, deleted: 4, unchanged: 0 }],
	])("draws %s", (_label: string, additions: number, deletions: number, expected: object) => {
		const blocks = diffStatBlocks(additions, deletions);

		expect(blocks).toEqual(expected);
		expect(blocks.added + blocks.deleted + blocks.unchanged).toBe(DIFF_STAT_SQUARES);
	});
});

describe("initiallyExpandedPaths", () => {
	it("opens every file with a short diff, and none without a diff", () => {
		const detail = GithubCommitDetailSchema.parse(githubCommitDetailJson(1));

		expect([...initiallyExpandedPaths(detail.files)]).toEqual(["src/app.ts"]);
	});

	it("keeps a file with a long diff collapsed, and still opens the short ones after it", () => {
		const files = [fileWithLines("long.ts", FILE_AUTO_EXPAND_LINES + 1), fileWithLines("short.ts", 10), fileWithoutDiff("logo.png")];

		expect([...initiallyExpandedPaths(files)]).toEqual(["short.ts"]);
	});

	it("stops opening files once the commit's budget of lines is spent", () => {
		const perFile = FILE_AUTO_EXPAND_LINES;
		const fitting = COMMIT_AUTO_EXPAND_LINES / perFile;
		const files = Array.from({ length: fitting + 1 }, (_entry: undefined, position: number): GithubCommitFile => fileWithLines(`f${String(position)}.ts`, perFile));

		expect(initiallyExpandedPaths(files).size).toBe(fitting);
		expect(initiallyExpandedPaths(files).has(`f${String(fitting)}.ts`)).toBe(false);
	});
});

describe("diffLineCount", () => {
	it("counts a patch's lines, and none without a diff", () => {
		expect(diffLineCount(fileWithLines("a.ts", 7))).toBe(7);
		expect(diffLineCount(fileWithoutDiff("logo.png"))).toBe(0);
	});
});
