// Keeps the CI e2e job honest: the `.env` it writes for the API (in
// .github/workflows/ci.yml) must pass the same schema the API validates at
// boot, or the job would fail on startup instead of running the suite.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseApiConfig } from "./api-config";

const WORKFLOW_PATH: string = fileURLToPath(new URL("../../../../.github/workflows/ci.yml", import.meta.url));

/** The heredoc the e2e job writes: `cat > apps/api/.env <<EOF … EOF`. */
const ENV_HEREDOC_PATTERN = /cat > apps\/api\/\.env <<EOF\n([\s\S]*?)\n\s*EOF/;
/** Shell expansions such as `${jwt_access}` inside the heredoc. */
const SHELL_VARIABLE_PATTERN = /\$\{(\w+)\}/g;
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
	tenant_master_key: Buffer.alloc(SECRET_BYTES, 2).toString("base64"),
};

function workflowEnv(): Record<string, string> {
	const heredoc = ENV_HEREDOC_PATTERN.exec(readFileSync(WORKFLOW_PATH, "utf8"))?.[1];
	if (heredoc === undefined) {
		throw new Error("The e2e job no longer writes apps/api/.env with a heredoc — update this test.");
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
	return env;
}

describe(".github/workflows/ci.yml — e2e job API env", () => {
	it("passes the API config schema", () => {
		expect(parseApiConfig(workflowEnv()).runtime.nodeEnv).toBe("test");
	});

	it("only references shell variables the job defines", () => {
		const heredoc = ENV_HEREDOC_PATTERN.exec(readFileSync(WORKFLOW_PATH, "utf8"))?.[1] ?? "";
		const unknown = [...heredoc.matchAll(SHELL_VARIABLE_PATTERN)]
			.map((match: RegExpExecArray): string => match[1] ?? "")
			.filter((name: string): boolean => !(name in SHELL_VARIABLES));
		expect(unknown).toEqual([]);
	});
});
