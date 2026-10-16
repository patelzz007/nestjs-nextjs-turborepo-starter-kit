import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { workingTreeFiles } from "./working-tree-files.mjs";

let repo = "";

function git(...args) {
	execFileSync("git", args, { cwd: repo, stdio: "ignore" });
}

beforeEach(() => {
	repo = mkdtempSync(path.join(tmpdir(), "working-tree-files-"));
	git("init", "-q");
	writeFileSync(path.join(repo, ".gitignore"), "ignored.ts\n");
	writeFileSync(path.join(repo, "kept.ts"), "");
	writeFileSync(path.join(repo, "moved.ts"), "");
	git("add", ".");
});

afterEach(() => {
	rmSync(repo, { recursive: true, force: true });
});

describe("workingTreeFiles", () => {
	it("lists tracked and new files, but not ignored ones", () => {
		writeFileSync(path.join(repo, "new.ts"), "");
		writeFileSync(path.join(repo, "ignored.ts"), "");
		expect(workingTreeFiles(repo, ["*.ts"]).sort()).toStrictEqual(["kept.ts", "moved.ts", "new.ts"]);
	});

	it("leaves out a tracked file deleted from disk before the deletion is staged", () => {
		rmSync(path.join(repo, "moved.ts"));
		expect(workingTreeFiles(repo, ["*.ts"])).toStrictEqual(["kept.ts"]);
	});
});
