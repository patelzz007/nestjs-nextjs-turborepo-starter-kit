import { GithubReviewThreadSchema, type GithubReviewThread } from "@workspace/shared";

import { GITHUB_COMMIT_PATCH, githubReviewThreadJson } from "../../../../../test/fixtures";
import { parsePatch } from "../../github/diff";
import { threadDiff, type DiffSegment } from "../diff-threads";

function thread(id: string, overrides: Parameters<typeof githubReviewThreadJson>[1] = {}): GithubReviewThread {
	return GithubReviewThreadSchema.parse(githubReviewThreadJson(id, overrides));
}

function shape(segments: readonly DiffSegment[]): readonly string[] {
	return segments.map((segment: DiffSegment): string =>
		segment.kind === "lines" ? `lines:${segment.lines.map((line) => line.text).join("|")}` : `threads:${segment.threads.map((entry) => entry.id).join(",")}`,
	);
}

describe("threadDiff", () => {
	const lines = parsePatch(GITHUB_COMMIT_PATCH);

	it("leaves a diff with no threads whole", () => {
		const threaded = threadDiff(lines, []);
		expect(threaded.segments).toHaveLength(1);
		expect(threaded.outdated).toEqual([]);
		expect(threaded.unplaced).toEqual([]);
	});

	it("puts a right-side thread under the new file's line, and a left-side one under the old file's", () => {
		const right = thread("T_right");
		const left = thread("T_left", { side: "left", line: 2 });

		const threaded = threadDiff(lines, [right, left]);

		expect(shape(threaded.segments)).toEqual([
			'lines:@@ -1,3 +1,4 @@ export function app() {|import { a } from "./a";|const b = 1;',
			"threads:T_left",
			"lines:const b = 2;",
			"threads:T_right",
			"lines:const c = 3;|export default a;",
		]);
		expect(threaded.unplaced).toEqual([]);
	});

	it("keeps two threads on one line together", () => {
		const threaded = threadDiff(lines, [thread("T_a"), thread("T_b")]);
		expect(shape(threaded.segments)).toContain("threads:T_a,T_b");
	});

	it("lists outdated threads apart, and threads on lines outside the diff after it", () => {
		const outdated = thread("T_outdated", { isOutdated: true, line: null });
		const elsewhere = thread("T_elsewhere", { line: 90 });

		const threaded = threadDiff(lines, [outdated, elsewhere]);

		expect(threaded.outdated).toEqual([outdated]);
		expect(threaded.unplaced).toEqual([elsewhere]);
		expect(threaded.segments).toHaveLength(1);
	});
});
