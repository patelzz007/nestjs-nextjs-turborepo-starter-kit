import { describe, expect, it } from "vitest";

import { stagedFilesNote } from "../pre-commit.ts";

describe("stagedFilesNote", () => {
	it("counts the staged files git lists", () => {
		expect(stagedFilesNote("a.ts\nb.ts\n")).toBe("2 staged files");
		expect(stagedFilesNote("a.ts\n")).toBe("1 staged file");
		expect(stagedFilesNote("")).toBe("0 staged files");
	});
});
