// The gate runs on the Droplet from the files the runbook's step 14 installs, not from a repository checkout
// (docs/technical/operations/digitalocean-deployment.md). A new import outside them would break every deploy, and
// only the Droplet would show it, so this test runs the gate from exactly those files.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");
const INSTALLED_PATHS = ["packages/tooling/src/deploy", "tooling.config.ts"];

describe("the installed deploy gate", () => {
	let installRoot: string;

	beforeEach(() => {
		installRoot = mkdtempSync(path.join(tmpdir(), "deploy-gate-"));
		for (const installed of INSTALLED_PATHS) {
			cpSync(path.join(REPO_ROOT, installed), path.join(installRoot, installed), { recursive: true });
		}
	});

	afterEach(() => {
		rmSync(installRoot, { recursive: true, force: true });
	});

	it("starts from the files the runbook installs", () => {
		const gate = spawnSync(process.execPath, [path.join(installRoot, "packages/tooling/src/deploy/gate-cli.ts")], {
			cwd: installRoot,
			encoding: "utf8",
			env: { DEPLOY_ROOT: installRoot },
		});

		expect(gate.stderr).toContain("Refused: expected `deploy <full commit sha>` or `rollback`.");
	});
});
