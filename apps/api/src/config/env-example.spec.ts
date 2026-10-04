// Keeps apps/api/.env.example honest: it documents EVERY variable the schema
// reads, and a fresh copy plus generated secrets passes validation.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parse as parseDotenv } from "dotenv";
import { describe, expect, it } from "vitest";

import { TEST_API_DATA_KEYS, TEST_API_SECRETS } from "../../test/support/test-api-env";
import { parseApiConfig } from "./api-config";
import { ApiEnvInputSchema } from "./api-config.schema";

const EXAMPLE_PATH: string = fileURLToPath(new URL("../../.env.example", import.meta.url));
const exampleText: string = readFileSync(EXAMPLE_PATH, "utf8");

/** `KEY=` assignments, active or commented out (`# KEY=value`). */
const DOCUMENTED_KEY_PATTERN = /^#?\s*([A-Z][A-Z0-9_]*)=/gm;

function documentedKeys(): Set<string> {
	return new Set([...exampleText.matchAll(DOCUMENTED_KEY_PATTERN)].map((match: RegExpExecArray): string => match[1] ?? ""));
}

describe("apps/api/.env.example", () => {
	it("documents every variable of the API env schema", () => {
		const documented: Set<string> = documentedKeys();
		const undocumented: string[] = Object.keys(ApiEnvInputSchema.shape).filter((key: string): boolean => !documented.has(key));

		expect(undocumented).toEqual([]);
	});

	it("ships every secret empty", () => {
		const active: Record<string, string> = parseDotenv(exampleText);
		for (const key of [
			...Object.keys(TEST_API_SECRETS),
			...Object.keys(TEST_API_DATA_KEYS),
			"RESEND_API_KEY",
			"RESEND_WEBHOOK_SECRET",
			"OBSERVE_APP_KEY",
			"OBSERVE_APP_SECRET",
		]) {
			expect(active[key] ?? "", key).toBe("");
		}
	});

	it("boots once the secrets are filled in (pnpm secrets:generate)", () => {
		const active: Record<string, string> = parseDotenv(exampleText);
		const withSecrets = { ...active, ...TEST_API_SECRETS, ...TEST_API_DATA_KEYS };

		expect(parseApiConfig(withSecrets).runtime.nodeEnv).toBe("development");
	});
});
