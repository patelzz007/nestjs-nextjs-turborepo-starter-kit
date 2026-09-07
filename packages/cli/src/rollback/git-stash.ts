import { spawn } from "node:child_process";

export interface GitCommandResult {
	readonly success: boolean;
	readonly stdout: string;
	readonly stderr: string;
}

export async function runGit(repoRoot: string, args: readonly string[]): Promise<GitCommandResult> {
	return new Promise((resolve) => {
		const child = spawn("git", args, {
			cwd: repoRoot,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on("close", (code) => {
			resolve({
				success: code === 0,
				stdout,
				stderr,
			});
		});
	});
}

export async function assertGitRepository(repoRoot: string): Promise<void> {
	const result = await runGit(repoRoot, ["rev-parse", "--is-inside-work-tree"]);
	if (!result.success || result.stdout.trim() !== "true") {
		throw new Error("Rollback requires a git repository. Initialize git or run rollback from the monorepo root.");
	}
}

export async function stashGeneratorPaths(repoRoot: string, message: string, paths: readonly string[]): Promise<string | null> {
	if (paths.length === 0) {
		throw new Error("No generator paths available to stash.");
	}
	const stashResult = await runGit(repoRoot, ["stash", "push", "-m", message, "--", ...paths]);
	if (!stashResult.success) {
		const detail = `${stashResult.stderr}\n${stashResult.stdout}`.trim();
		if (detail.includes("No local changes to save")) {
			return null;
		}
		throw new Error(`git stash failed: ${detail}`);
	}
	const listResult = await runGit(repoRoot, ["stash", "list", "--format=%gd|%s"]);
	if (!listResult.success) {
		throw new Error("git stash succeeded but listing stashes failed.");
	}
	const lines = listResult.stdout
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	for (const line of lines) {
		const separatorIndex = line.indexOf("|");
		if (separatorIndex === -1) {
			continue;
		}
		const ref = line.slice(0, separatorIndex);
		const stashMessage = line.slice(separatorIndex + 1);
		if (stashMessage === message) {
			return ref;
		}
	}
	throw new Error(`Could not find git stash entry for message: ${message}`);
}

export async function dropGitStash(repoRoot: string, stashRef: string): Promise<void> {
	const result = await runGit(repoRoot, ["stash", "drop", stashRef]);
	if (!result.success) {
		const detail = result.stderr.trim().length > 0 ? result.stderr.trim() : result.stdout.trim();
		if (detail.includes("No stash entries found") || detail.includes("is not a valid reference")) {
			return;
		}
		throw new Error(`git stash drop failed: ${detail}`);
	}
}
