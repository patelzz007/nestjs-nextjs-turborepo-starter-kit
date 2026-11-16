#!/usr/bin/env node
/**
 * The SSH forced command of the docs deploy key (plan §10, ADR 084). GitHub Actions connects with a key whose
 * `authorized_keys` line runs THIS script and nothing else, asking for `receive <commit> <sha256>` and sending the
 * build on standard input. It checks the upload, unpacks it into docs-releases/<commit>, switches `docs-current`
 * atomically, reloads only the docs process and checks the site. Any failure switches back and exits non-zero.
 *
 * It never runs migrations and never touches the API or web apps.
 *
 * DEPLOY_ROOT (/srv/<slug>) and DOCS_PORT are set in the authorized_keys line. Installed by the guide:
 * docs/technical/operations/docs-publishing.md.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readdirSync, readlinkSync, renameSync, rmSync, statSync, symlinkSync } from "node:fs";
import path from "node:path";
import { Transform, type TransformCallback } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
	DOCS_HEALTH_PATHS,
	DOCS_PORT,
	DOCS_RELEASE_FILES,
	DOCS_RELEASE_INFO_PATH,
	docsLayout,
	docsReleasesToPrune,
	isUnsafeArchiveEntry,
	MAX_DOCS_RELEASE_BYTES,
	parseDocsGateCommand,
} from "./docs-deploy-plan.ts";

const HEALTH_ATTEMPTS = 30;
const HEALTH_INTERVAL_MS = 2_000;
const HEALTH_TIMEOUT_MS = 5_000;
const USAGE_EXIT_CODE = 2;
const BUSY_EXIT_CODE = 3;
const FAILED_EXIT_CODE = 1;

// This runs on the Droplet with no node_modules, like the platform's gate: Node's own modules only, so no zod here.
const root = process.env.DEPLOY_ROOT;
if (root === undefined || !path.isAbsolute(root)) {
	process.stderr.write("DEPLOY_ROOT must be an absolute path, set in authorized_keys.\n");
	process.exit(USAGE_EXIT_CODE);
}
const command = parseDocsGateCommand(process.env.SSH_ORIGINAL_COMMAND);
if (command.kind === "refused") {
	process.stderr.write(`Refused: ${command.reason}.\n`);
	process.exit(USAGE_EXIT_CODE);
}
const layout = docsLayout(root);
const { commit, sha256 } = command;

function say(line: string): void {
	process.stdout.write(`${line}\n`);
}

function run(file: string, args: readonly string[]): string {
	const result = spawnSync(file, [...args], { encoding: "utf8", maxBuffer: Number.MAX_SAFE_INTEGER });
	if (result.status !== 0) {
		throw new Error(`${file} ${args.join(" ")} failed: ${result.stderr}`);
	}
	return result.stdout;
}

/** Counts and hashes the upload as it streams to disk, and stops it at the size cap. */
async function receiveArchive(target: string): Promise<void> {
	const hash = createHash("sha256");
	let received = 0;
	const meter = new Transform({
		transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback): void {
			received += chunk.length;
			if (received > MAX_DOCS_RELEASE_BYTES) {
				done(new Error("The upload is larger than the size cap."));
				return;
			}
			hash.update(chunk);
			done(null, chunk);
		},
	});
	await pipeline(process.stdin, meter, createWriteStream(target));
	if (hash.digest("hex") !== sha256) {
		throw new Error("The upload's SHA-256 does not match.");
	}
}

function unpack(archive: string, release: string): void {
	const entries = run("tar", ["-tzf", archive])
		.split("\n")
		.filter((entry) => entry.length > 0);
	const unsafe = entries.find(isUnsafeArchiveEntry);
	if (unsafe !== undefined) {
		throw new Error(`The upload holds an unsafe path: ${unsafe}`);
	}
	mkdirSync(release, { recursive: true });
	run("tar", ["-xzf", archive, "-C", release, "--no-same-owner"]);
	for (const file of DOCS_RELEASE_FILES) {
		if (!existsSync(path.join(release, file))) {
			throw new Error(`The upload is missing ${file}.`);
		}
	}
}

/** Points `link` at `target` atomically (a temporary link renamed over it). */
function pointAt(link: string, target: string): void {
	const temporary = `${link}.next`;
	rmSync(temporary, { force: true });
	symlinkSync(target, temporary);
	renameSync(temporary, link);
}

function reload(): void {
	run("pm2", ["startOrReload", path.join(layout.current, "ecosystem.config.cjs"), "--update-env"]);
}

async function isServing(expectedCommit: string): Promise<boolean> {
	const origin = `http://127.0.0.1:${String(DOCS_PORT)}`;
	try {
		const info = await fetch(`${origin}${DOCS_RELEASE_INFO_PATH}`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
		if (!info.ok || !(await info.text()).includes(expectedCommit)) {
			return false;
		}
		const pages = await Promise.all(DOCS_HEALTH_PATHS.map((page) => fetch(`${origin}${page}`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) })));
		return pages.every((page) => page.ok);
	} catch {
		return false;
	}
}

async function waitUntilServing(expectedCommit: string): Promise<boolean> {
	for (let attempt = 0; attempt < HEALTH_ATTEMPTS; attempt += 1) {
		if (await isServing(expectedCommit)) {
			return true;
		}
		await new Promise((resolve) => {
			setTimeout(resolve, HEALTH_INTERVAL_MS);
		});
	}
	return false;
}

function prune(): void {
	const names = readdirSync(layout.releases)
		.map((name) => path.join(layout.releases, name))
		.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
	const protectedReleases = [layout.current, layout.lastGood].flatMap((link) => (existsSync(link) ? [readlinkSync(link)] : []));
	for (const release of docsReleasesToPrune(names, protectedReleases)) {
		rmSync(release, { recursive: true, force: true });
	}
}

async function deploy(): Promise<void> {
	mkdirSync(layout.releases, { recursive: true });
	const release = layout.release(commit);
	const archive = `${release}.tar.gz`;
	const previous = existsSync(layout.current) ? readlinkSync(layout.current) : null;
	await receiveArchive(archive);
	rmSync(release, { recursive: true, force: true });
	unpack(archive, release);
	rmSync(archive, { force: true });
	pointAt(layout.current, release);
	reload();
	if (await waitUntilServing(commit)) {
		pointAt(layout.lastGood, release);
		prune();
		say(`Docs ${commit} is live.`);
		return;
	}
	if (previous === null) {
		throw new Error("The new release failed its health check, and there is no earlier release to go back to.");
	}
	pointAt(layout.current, previous);
	reload();
	const isRestored = await waitUntilServing(path.basename(previous));
	throw new Error(
		isRestored
			? "The new release failed its health check. Rolled back."
			: "The new release failed its health check, and the rollback did not come up. See the manual recovery steps in the guide.",
	);
}

// One deploy at a time: mkdir is atomic, so a second request fails here instead of racing.
try {
	mkdirSync(layout.lock);
} catch {
	process.stderr.write(`Another docs deploy is running (${layout.lock} exists). If none is, remove it and retry.\n`);
	process.exit(BUSY_EXIT_CODE);
}

try {
	await deploy();
} catch (error) {
	process.stderr.write(`${error instanceof Error ? error.message : "The deploy failed."}\n`);
	process.exitCode = FAILED_EXIT_CODE;
} finally {
	rmSync(layout.lock, { recursive: true, force: true });
}
