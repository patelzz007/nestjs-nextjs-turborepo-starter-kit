// The repository files a guard should check: tracked or new (untracked, not
// ignored), and present on disk. `git ls-files --cached` alone still lists a
// file that was moved or deleted but whose removal is not staged yet, so a
// guard would flag (or fail to read) a file that no longer exists; lint and
// the tests run on the working tree, and so do the guards.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/** Repo-relative paths under `pathspecs` that exist in the working tree. */

export function workingTreeFiles(repoRoot: string, pathspecs: readonly string[]): string[] {
	return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--", ...pathspecs], { cwd: repoRoot, encoding: "utf8" })
		.split("\n")
		.filter((file) => file.length > 0 && existsSync(path.join(repoRoot, file)));
}
