#!/usr/bin/env node
// `node ../../packages/tooling/src/playwright-in-docker/cli.ts <env prefix> [--forward <port>[:<host port>]]…
// [playwright test args…]`, from a workspace (enhancement 3.8): runs that workspace's Playwright suite in Playwright's
// Linux image, so the screenshots it takes or compares are the ones CI takes. The suite's `<prefix>*` variables
// (base URL, login, Mailpit) are passed in unchanged, and each `--forward` port on the container's localhost reaches
// this machine (the same port, or the one after the colon), so the browser sees the very origins it would outside.
// E.g. `pnpm --filter @workspace/admin test:visual:update`.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

import { containerEnv, dockerRunArgs, forwardsArgument, parseForwards, playwrightImage } from "./playwright-in-docker.ts";
import { z } from "zod";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const [prefix, ...options] = process.argv.slice(2).filter((argument) => argument !== "--");
if (prefix === undefined || prefix.length === 0) {
	process.stderr.write("Usage: src/playwright-in-docker/cli.ts <env prefix, e.g. ADMIN_E2E_> [playwright test args…]\n");
	process.exit(1);
}
const { forwards, rest: playwrightArgs } = parseForwards(options);
const workdir = process.cwd();
const requireFromWorkspace = createRequire(path.join(workdir, "package.json"));
const { version } = z.object({ version: z.string() }).parse(requireFromWorkspace("@playwright/test/package.json"));
// The CLI the workspace resolves (possibly hoisted to the repository root): the same path inside the container.
const cli = requireFromWorkspace.resolve("@playwright/test/cli");
const userInfo = { uid: process.getuid?.() ?? 0, gid: process.getgid?.() ?? 0 };
const args = dockerRunArgs({
	image: playwrightImage(version),
	repoRoot: REPO_ROOT,
	workdir,
	...userInfo,
	env: containerEnv(process.env, prefix),
	command: ["node", path.join(import.meta.dirname, "docker-forward-and-run.ts"), forwardsArgument(forwards), "node", cli, "test", ...playwrightArgs],
});
const run = spawnSync("docker", args, { stdio: "inherit" });
process.exit(run.status ?? 1);
