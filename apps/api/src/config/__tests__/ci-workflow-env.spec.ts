// Keeps every database-backed CI job honest: the env they boot the API with is written by ONE generator
// (packages/tooling/scripts/write-api-ci-env.mjs, called by .github/actions/write-api-ci-env and by
// `pnpm ci:local`). Its output must pass the same schema the API validates at boot, and must turn on
// everything the seed needs, or the seed coverage check fails in CI only.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "dotenv";
import { afterAll, describe, expect, it } from "vitest";

import { parseApiConfig } from "../api-config";

const REPO_ROOT: string = fileURLToPath(new URL("../../../../../", import.meta.url));
const GENERATOR = join(REPO_ROOT, "packages/tooling/scripts/write-api-ci-env.mjs");
const ACTION_PATH = join(REPO_ROOT, ".github/actions/write-api-ci-env/action.yml");
const DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/app_ci";
/** The tenant `pnpm db:seed` creates, which the browser job serves in single mode. */
const SEED_DEFAULT_TENANT_ID = "019b76da-a800-7a94-a198-23ad1b4cfdd9";

const workDir = mkdtempSync(join(tmpdir(), "api-ci-env-"));

afterAll((): void => {
	rmSync(workDir, { recursive: true, force: true });
});

interface GeneratorRun {
	readonly status: number | null;
	readonly env: Record<string, string>;
}

function runGenerator(name: string, args: readonly string[]): GeneratorRun {
	const out = join(workDir, `${name}.env`);
	const result = spawnSync(process.execPath, [GENERATOR, "--out", out, "--database-url", DATABASE_URL, ...args], { encoding: "utf8" });
	return { status: result.status, env: result.status === 0 ? parse(readFileSync(out, "utf8")) : {} };
}

describe("the CI API env (packages/tooling/scripts/write-api-ci-env.mjs)", () => {
	const multi = runGenerator("multi", ["--tenancy-mode", "multi"]);
	const single = runGenerator("single", ["--tenancy-mode", "single", "--default-tenant-id", SEED_DEFAULT_TENANT_ID]);

	it("passes the API config schema in both tenancy modes", () => {
		expect(multi.status).toBe(0);
		expect(single.status).toBe(0);
		expect(parseApiConfig(multi.env).tenancy.mode).toBe("multi");
		expect(parseApiConfig(single.env).tenancy.mode).toBe("single");
		expect(parseApiConfig(multi.env).runtime.nodeEnv).toBe("test");
	});

	it("never sets a default tenant in multi mode, and refuses single mode without one", () => {
		expect(multi.env).not.toHaveProperty("DEFAULT_TENANT_ID");
		expect(single.env).toHaveProperty("DEFAULT_TENANT_ID", SEED_DEFAULT_TENANT_ID);
		expect(runGenerator("single-without-tenant", ["--tenancy-mode", "single"]).status).not.toBe(0);
	});

	it("turns on every key ring the seed seals data with, so the seed coverage check sees those tables filled", () => {
		const config = parseApiConfig(multi.env);
		expect(config.github.credentialEncryptionKeys).not.toBeNull();
		// Push devices: without this key the seed writes no PushDevice row (and no delivery points at one).
		expect(config.notifications.encryptionKeys).not.toBeNull();
	});

	it("is what the GitHub action writes: the action runs the generator instead of keeping its own copy", () => {
		const action = readFileSync(ACTION_PATH, "utf8");
		expect(action).toContain("node packages/tooling/scripts/write-api-ci-env.mjs");
		expect(action).toContain("--mask-secrets");
		expect(action).not.toMatch(/<<EOF|cat > apps\/api\/\.env/u);
	});
});
