#!/usr/bin/env node
/**
 * Builds and activates THIS release (the directory this file is in, under releases/<sha>), run by the
 * deploy gate (ADR 075). Steps, in order; a failure before the switch changes nothing that is live, a
 * failure after it switches back:
 *
 *   1. link shared/env/<app>.env to apps/<app>/.env (the API's dotenv and Next.js read them);
 *   2. install from the lockfile, build the API and the three Next.js apps, then with the migration login
 *      apply migrations and the security SQL (`db:deploy`) and the reference data: migrations must keep
 *      the running release working (expand/contract);
 *   3. point `previous` at the live release and switch `current` to this one atomically;
 *   4. reload the pm2 processes from this release's ecosystem file, then `pm2 save`;
 *   5. health-check every app; on failure switch back, reload the old release, and exit non-zero;
 *   6. prune old releases (never the live or the previous one).
 *
 * `--activate-only` skips step 2 (a rollback to a release that was built before).
 */
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readlinkSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildSteps, deployLayout, envLinks, healthUrl, isHealthy, PLATFORM_APPS, releasesToPrune, requiredEnvFiles } from "./lib/deploy-plan.mjs";

const HEALTH_ATTEMPTS = 60;
const HEALTH_INTERVAL_MS = 2_000;
const HEALTH_TIMEOUT_MS = 5_000;

const root = process.env.DEPLOY_ROOT;
if (root === undefined || !path.isAbsolute(root)) {
	console.error("DEPLOY_ROOT must be set (the deploy gate sets it).");
	process.exit(2);
}
const layout = deployLayout(root);
const release = path.resolve(import.meta.dirname, "../../../..");
const activateOnly = process.argv.includes("--activate-only");

function run(file, args, extraEnv = {}) {
	console.log(`\n$ ${file} ${args.join(" ")}`);
	const result = spawnSync(file, args, { cwd: release, stdio: "inherit", env: { ...process.env, ...extraEnv } });
	if (result.status !== 0) {
		throw new Error(`${file} ${args.join(" ")} exited with ${String(result.status ?? result.signal)}`);
	}
}

/** Points `link` at `target` atomically (a temporary link renamed over it). */
function pointAt(link, target) {
	const temporary = `${link}.next`;
	rmSync(temporary, { force: true });
	symlinkSync(target, temporary);
	renameSync(temporary, link);
}

function linkTarget(link) {
	return existsSync(link) && lstatSync(link).isSymbolicLink() ? readlinkSync(link) : null;
}

function reload(releaseDir) {
	run("pm2", ["startOrReload", path.join(releaseDir, "deploy/pm2/ecosystem.config.cjs"), "--update-env"]);
	run("pm2", ["save"]);
}

async function healthy(app) {
	for (let attempt = 1; attempt <= HEALTH_ATTEMPTS; attempt += 1) {
		try {
			const response = await fetch(healthUrl(app), { redirect: "manual", signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
			if (isHealthy(app, response.status)) {
				return true;
			}
		} catch {
			// Not listening yet.
		}
		await new Promise((done) => setTimeout(done, HEALTH_INTERVAL_MS));
	}
	return false;
}

async function allHealthy() {
	for (const app of PLATFORM_APPS) {
		if (!(await healthy(app))) {
			console.error(`✗ ${app.app} did not become healthy at ${healthUrl(app)}`);
			return false;
		}
		console.log(`✓ ${app.app} is up`);
	}
	return true;
}

function prune() {
	const names = readdirSync(layout.releases).filter((name) => /^[0-9a-f]{40}$/u.test(name));
	const releases = names.map((name) => ({ name, deployedAt: statSync(path.join(layout.releases, name)).mtimeMs }));
	const current = linkTarget(layout.current);
	const previous = linkTarget(layout.previous);
	for (const name of releasesToPrune(releases, { current: current === null ? null : path.basename(current), previous: previous === null ? null : path.basename(previous) })) {
		console.log(`Pruning release ${name}`);
		rmSync(path.join(layout.releases, name), { recursive: true, force: true });
	}
}

for (const file of requiredEnvFiles(layout.envDir)) {
	if (!existsSync(file)) {
		console.error(`Missing ${file}: create it as the deployment guide's step 10 says.`);
		process.exit(1);
	}
}
for (const { source, link } of envLinks(layout.envDir, release)) {
	rmSync(link, { force: true });
	symlinkSync(source, link);
}

try {
	if (!activateOnly) {
		for (const step of buildSteps(layout.envDir)) {
			const [file = "", ...args] = step.argv;
			run(file, args, step.env);
		}
	}
} catch (error) {
	console.error(`Build failed; nothing live was changed. ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
}

const live = linkTarget(layout.current);
if (live !== null && live !== release) {
	pointAt(layout.previous, live);
}
pointAt(layout.current, release);
writeFileSync(path.join(release, ".deployed-at"), `${new Date().toISOString()}\n`);
console.log(`\ncurrent → ${release}`);

let ok = false;
try {
	reload(release);
	ok = await allHealthy();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
}

if (!ok) {
	if (live === null || live === release) {
		console.error("The release is unhealthy and there is no earlier release to return to.");
		process.exit(1);
	}
	console.error(`Rolling back to ${live}`);
	pointAt(layout.current, live);
	reload(live);
	const recovered = await allHealthy();
	console.error(
		recovered
			? "Rolled back; the previous release is healthy."
			: "Rolled back, but the previous release is unhealthy too: see the manual recovery steps in the deployment guide.",
	);
	process.exit(1);
}

prune();
console.log("\n✓ Deployed");
