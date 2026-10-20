// Keeps the CI e2e job honest: the `.env` it writes for the API (in
// .github/actions/write-api-ci-env/action.yml, used by every database-backed CI job) must pass the same schema the API validates at
// boot, or the job would fail on startup instead of running the suite.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseApiConfig } from "../api-config";

const WORKFLOW_PATH: string = fileURLToPath(new URL("../../../../../.github/actions/write-api-ci-env/action.yml", import.meta.url));

/** The heredoc the e2e job writes: `cat > apps/api/.env <<EOF … EOF`. */
const ENV_HEREDOC_PATTERN = /cat > apps\/api\/\.env <<EOF\n(?<body>[\s\S]*?)\n\s*EOF/;
/** Shell expansions such as `${jwt_access}` inside the heredoc. */
const SHELL_VARIABLE_PATTERN = /\$\{(?<name>\w+)\}/g;
/** Length of each generated secret, in bytes (the job uses `openssl rand`). */
const SECRET_BYTES = 32;

/**
 * Stand-ins for the values the job generates at runtime: each distinct and of
 * the same shape (`openssl rand -hex 32` / `-base64 32`).
 */
const SHELL_VARIABLES: Readonly<Record<string, string>> = {
	DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/app_ci",
	jwt_access: "a".repeat(SECRET_BYTES * 2),
	jwt_refresh: "b".repeat(SECRET_BYTES * 2),
	email_verification: "c".repeat(SECRET_BYTES * 2),
	two_factor: "d".repeat(SECRET_BYTES * 2),
	mfa_key: Buffer.alloc(SECRET_BYTES, 1).toString("base64"),
	reward_code_key: Buffer.alloc(SECRET_BYTES, 3).toString("base64"),
	tenant_master_key: Buffer.alloc(SECRET_BYTES, 2).toString("base64"),
	github_credential_key: Buffer.alloc(SECRET_BYTES, 4).toString("base64"),
};

/** The tenancy lines the action appends after the heredoc, per `tenancy-mode` (multi-tenancy plan MT-70). */
const MULTI_TENANCY_APPEND = 'echo "TENANCY_ENABLED=true" >> apps/api/.env';
const SINGLE_TENANCY_APPEND = "printf 'TENANCY_ENABLED=false\\nDEFAULT_TENANT_ID=%s\\n' \"$DEFAULT_TENANT_ID_INPUT\" >> apps/api/.env";
/** The tenant `pnpm db:seed` creates, which the browser job serves in single mode. */
const SEED_DEFAULT_TENANT_ID = "019b76da-a800-7a94-a198-23ad1b4cfdd9";

type TenancyMode = "multi" | "single";

function tenancyLines(mode: TenancyMode): Record<string, string> {
	return mode === "multi" ? { TENANCY_ENABLED: "true" } : { TENANCY_ENABLED: "false", DEFAULT_TENANT_ID: SEED_DEFAULT_TENANT_ID };
}

function workflowEnv(mode: TenancyMode = "multi"): Record<string, string> {
	const heredoc = ENV_HEREDOC_PATTERN.exec(readFileSync(WORKFLOW_PATH, "utf8"))?.groups?.body;
	if (heredoc === undefined) {
		throw new Error("The write-api-ci-env action no longer writes apps/api/.env with a heredoc — update this test.");
	}
	const env: Record<string, string> = {};
	for (const rawLine of heredoc.split("\n")) {
		const line = rawLine.trim();
		const separator = line.indexOf("=");
		if (separator <= 0) {
			continue;
		}
		env[line.slice(0, separator)] = line.slice(separator + 1).replace(SHELL_VARIABLE_PATTERN, (_match: string, name: string): string => SHELL_VARIABLES[name] ?? "");
	}
	return { ...env, ...tenancyLines(mode) };
}

describe(".github/actions/write-api-ci-env — CI API env", () => {
	it("passes the API config schema in both tenancy modes", () => {
		expect(parseApiConfig(workflowEnv("multi")).tenancy.mode).toBe("multi");
		expect(parseApiConfig(workflowEnv("single")).tenancy.mode).toBe("single");
		expect(parseApiConfig(workflowEnv()).runtime.nodeEnv).toBe("test");
	});

	it("appends exactly the tenancy lines this test models, and never a default tenant in multi mode", () => {
		const action = readFileSync(WORKFLOW_PATH, "utf8");
		expect(action).toContain(MULTI_TENANCY_APPEND);
		expect(action).toContain(SINGLE_TENANCY_APPEND);
		expect(ENV_HEREDOC_PATTERN.exec(action)?.groups?.body).not.toMatch(/TENANCY_ENABLED|DEFAULT_TENANT_ID/);
	});

	it("turns GitHub pull requests on, so the seed fills github_account_links for the seed coverage check", () => {
		expect(parseApiConfig(workflowEnv()).github.credentialEncryptionKeys).not.toBeNull();
	});

	it("only references shell variables the job defines", () => {
		const heredoc = ENV_HEREDOC_PATTERN.exec(readFileSync(WORKFLOW_PATH, "utf8"))?.groups?.body ?? "";
		const unknown = [...heredoc.matchAll(SHELL_VARIABLE_PATTERN)]
			.map((match: RegExpExecArray): string => match.groups?.name ?? "")
			.filter((name: string): boolean => !(name in SHELL_VARIABLES));
		expect(unknown).toEqual([]);
	});
});
