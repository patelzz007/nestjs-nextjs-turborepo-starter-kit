import { describe, expect, it } from "vitest";

import { API_CI_SECRETS, apiCiEnv, randomSecret, renderEnvFile } from "../api-ci-env.mjs";
import { CI_BUILD_ENV } from "../ci-local-plan.mjs";

const DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/app_ci?schema=public";
const TENANT_ID = "019b76da-a800-7a94-a198-23ad1b4cfdd9";

/** A predictable secret per call, so the output can be asserted exactly. */
function countingSecret() {
	let calls = 0;
	return (format) => {
		calls += 1;
		return `${format}-${String(calls)}`;
	};
}

function envOf(entries) {
	return Object.fromEntries(entries);
}

describe("apiCiEnv", () => {
	it("advertises the same API address the apps are built to call, so their content security policy allows uploads to it", () => {
		const env = envOf(apiCiEnv({ databaseUrl: DATABASE_URL, tenancyMode: "multi", secret: countingSecret() }).entries);
		expect(env.API_PUBLIC_URL).toBe(CI_BUILD_ENV.NEXT_PUBLIC_API_URL);
	});

	it("points the API at the job's database and sets every generated secret", () => {
		const { entries, secrets } = apiCiEnv({ databaseUrl: DATABASE_URL, tenancyMode: "multi", secret: countingSecret() });
		const env = envOf(entries);
		expect(env.DATABASE_URL).toBe(DATABASE_URL);
		expect(secrets).toHaveLength(API_CI_SECRETS.length);
		for (const { name } of API_CI_SECRETS) {
			expect(env[name]).toBeDefined();
		}
	});

	it("writes key rings as version 1 and plain secrets as they are", () => {
		const env = envOf(apiCiEnv({ databaseUrl: DATABASE_URL, tenancyMode: "multi", secret: countingSecret() }).entries);
		expect(JSON.parse(env.NOTIFICATIONS_ENCRYPTION_KEYS)).toEqual({ 1: expect.stringMatching(/^base64-\d+$/u) });
		expect(env.JWT_ACCESS_SECRET).toMatch(/^hex-\d+$/u);
	});

	it("turns on every key ring the seed seals data with, including push device tokens and webhook secrets", () => {
		const names = API_CI_SECRETS.map((secret) => secret.name);
		expect(names).toEqual(expect.arrayContaining(["GITHUB_CREDENTIAL_ENCRYPTION_KEYS", "NOTIFICATIONS_ENCRYPTION_KEYS", "WEBHOOK_SECRET_ENCRYPTION_KEYS"]));
	});

	it("never sets a default tenant in multi mode, and serves exactly one in single mode", () => {
		const multi = envOf(apiCiEnv({ databaseUrl: DATABASE_URL, tenancyMode: "multi" }).entries);
		expect(multi.TENANCY_ENABLED).toBe("true");
		expect(multi.DEFAULT_TENANT_ID).toBeUndefined();
		const single = envOf(apiCiEnv({ databaseUrl: DATABASE_URL, tenancyMode: "single", defaultTenantId: TENANT_ID }).entries);
		expect(single).toMatchObject({ TENANCY_ENABLED: "false", DEFAULT_TENANT_ID: TENANT_ID });
	});

	it("refuses single mode without a tenant, an unknown mode, and an empty database URL", () => {
		expect(() => apiCiEnv({ databaseUrl: DATABASE_URL, tenancyMode: "single" })).toThrow("default tenant");
		expect(() => apiCiEnv({ databaseUrl: DATABASE_URL, tenancyMode: "both" })).toThrow("multi or single");
		expect(() => apiCiEnv({ databaseUrl: "", tenancyMode: "multi" })).toThrow("database URL");
	});

	it("generates a fresh 32-byte secret each time", () => {
		const first = randomSecret("base64");
		expect(Buffer.from(first, "base64")).toHaveLength(32);
		expect(randomSecret("hex")).toMatch(/^[0-9a-f]{64}$/u);
		expect(randomSecret("base64")).not.toBe(first);
	});
});

describe("renderEnvFile", () => {
	it("writes one NAME=value line per entry, ending in a newline", () => {
		expect(
			renderEnvFile([
				["A", "1"],
				["B", '{"1":"x"}'],
			]),
		).toBe('A=1\nB={"1":"x"}\n');
	});
});
