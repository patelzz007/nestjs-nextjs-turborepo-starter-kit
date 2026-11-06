#!/usr/bin/env node
/**
 * The SSH forced command of the deploy key (ADR 075). GitHub Actions connects with a key whose
 * `authorized_keys` line runs THIS script and nothing else (no shell, no forwarding), asking for
 * `deploy <full commit sha>` or `rollback` through SSH_ORIGINAL_COMMAND.
 *
 * deploy:   fetch main, refuse a commit that isn't on it, unpack the commit into releases/<sha> with
 *           `git archive` (no working copy, no hooks), then run THAT release's src/deploy/release-cli.ts, so the
 *           deploy logic always matches the code it deploys.
 * rollback: re-activate the release `previous` points at (no build, no migration).
 *
 * Installed once per Droplet (docs/technical/operations/digitalocean-deployment.md, step 14):
 *   git archive main packages/tooling/src/deploy tooling.config.ts, unpacked into /srv/<slug>/bin/deploy
 * DEPLOY_ROOT (/srv/<slug>) is set in the authorized_keys line.
 */
import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { existsSync, mkdirSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { deployLayout, parseGateCommand } from "./deploy-plan.ts";

const root = process.env.DEPLOY_ROOT;
if (root === undefined || !path.isAbsolute(root)) {
	process.stderr.write("DEPLOY_ROOT must be set to the deploy root (an absolute path) in authorized_keys.\n");
	process.exit(2);
}
const layout = deployLayout(root);
const command = parseGateCommand(process.env.SSH_ORIGINAL_COMMAND);
if (command.kind === "refused") {
	process.stderr.write(`Refused: ${command.reason}.\n`);
	process.exit(2);
}

/** Runs a command, streaming its output; throws when it fails. */
function run(file: string, args: readonly string[], options: SpawnSyncOptions = {}): void {
	const result = spawnSync(file, args, { stdio: "inherit", ...options });
	if (result.status !== 0) {
		throw new Error(`${file} ${args.join(" ")} exited with ${String(result.status ?? result.signal)}`);
	}
}

/** True when `git` answers the check with success. */
function gitSucceeds(args: readonly string[]): boolean {
	return spawnSync("git", ["-C", layout.repository, ...args], { stdio: "ignore" }).status === 0;
}

// One deploy at a time: mkdir is atomic, so a second request fails here instead of racing.
try {
	mkdirSync(layout.lock);
} catch {
	process.stderr.write(`Another deploy is running (${layout.lock} exists). If none is, remove it and retry.\n`);
	process.exit(3);
}

let exitCode = 0;
try {
	if (command.kind === "rollback") {
		if (!existsSync(layout.previous)) {
			throw new Error("There is no previous release to roll back to.");
		}
		const previous = readlinkSync(layout.previous);
		process.stdout.write(`Rolling back to ${path.basename(previous)}\n`);
		run("node", [path.join(previous, "packages/tooling/src/deploy/release-cli.ts"), "--activate-only"], { cwd: previous, env: { ...process.env, DEPLOY_ROOT: root } });
	} else {
		const { commit } = command;
		process.stdout.write(`Deploying ${commit}\n`);
		run("git", ["-C", layout.repository, "fetch", "--quiet", "--prune", "origin", "+refs/heads/main:refs/remotes/origin/main"]);
		if (!gitSucceeds(["cat-file", "-e", `${commit}^{commit}`]) || !gitSucceeds(["merge-base", "--is-ancestor", commit, "refs/remotes/origin/main"])) {
			throw new Error(`${commit} is not a commit on main.`);
		}
		const release = layout.release(commit);
		if (!existsSync(release)) {
			const unpacking = `${release}.partial`;
			rmSync(unpacking, { recursive: true, force: true });
			mkdirSync(unpacking, { recursive: true });
			run("sh", ["-c", 'git -C "$1" archive --format=tar "$2" | tar -x -C "$3"', "unpack", layout.repository, commit, unpacking]);
			writeFileSync(path.join(unpacking, "REVISION"), `${commit}\n`);
			run("mv", ["-T", unpacking, release]);
		}
		run("node", [path.join(release, "packages/tooling/src/deploy/release-cli.ts")], { cwd: release, env: { ...process.env, DEPLOY_ROOT: root } });
	}
} catch (error) {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	exitCode = 1;
} finally {
	rmSync(layout.lock, { recursive: true, force: true });
}
process.exit(exitCode);
