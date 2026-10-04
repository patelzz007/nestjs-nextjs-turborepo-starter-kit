import { EnvValidationError, parseEnvOrThrow, PUBLIC_ENV_PREFIX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { clientEnv } from "./env.client";
import { WEB_ENV_SCOPE, WebClientEnvSchema, WebServerEnvSchema } from "./env.schema";
import { serverEnv } from "./env.server";

const VALID_PUBLIC_SOURCE: Readonly<Record<string, string>> = {
	NEXT_PUBLIC_API_URL: "https://api.example.com",
	NEXT_PUBLIC_APP_URL: "https://www.example.com",
};

describe("WebClientEnvSchema", () => {
	it("declares only NEXT_PUBLIC_* keys", () => {
		const keys: string[] = Object.keys(WebClientEnvSchema.shape);
		expect(keys.length).toBeGreaterThan(0);
		expect(keys.filter((key: string): boolean => !key.startsWith(PUBLIC_ENV_PREFIX))).toEqual([]);
	});

	it("does not expose the demo-accounts flag to the browser", () => {
		expect(Object.keys(WebClientEnvSchema.shape)).not.toContain("NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS");
		expect(Object.keys(parseEnvOrThrow(WebClientEnvSchema, VALID_PUBLIC_SOURCE, WEB_ENV_SCOPE.client)).sort()).toEqual(Object.keys(VALID_PUBLIC_SOURCE).sort());
	});

	it("names every missing required variable without printing values", () => {
		const run = (): void => {
			parseEnvOrThrow(WebClientEnvSchema, {}, WEB_ENV_SCOPE.client);
		};
		expect(run).toThrow(EnvValidationError);
		expect(run).toThrow(/NEXT_PUBLIC_API_URL: is required but not set/);
		expect(run).toThrow(/NEXT_PUBLIC_APP_URL: is required but not set/);
	});

	it("rejects a non-URL API base", () => {
		expect(WebClientEnvSchema.safeParse({ ...VALID_PUBLIC_SOURCE, NEXT_PUBLIC_API_URL: "api.example.com" }).success).toBe(false);
	});
});

describe("WebServerEnvSchema", () => {
	it("requires NODE_ENV, leaves COOKIE_DOMAIN optional", () => {
		expect(WebServerEnvSchema.parse({ NODE_ENV: "production" })).toEqual({ NODE_ENV: "production", COOKIE_DOMAIN: undefined });
		expect(WebServerEnvSchema.safeParse({}).success).toBe(false);
	});

	it("has no demo-accounts switch, so demo accounts cannot be forced on by configuration", () => {
		expect(WebServerEnvSchema.safeParse({ NODE_ENV: "production", SHOW_DEMO_ACCOUNTS: "true" }).success).toBe(false);
	});
});

describe("env modules", () => {
	it("client env exposes only NEXT_PUBLIC_* keys", () => {
		const keys: string[] = Object.keys(clientEnv);
		expect(keys.sort()).toEqual(Object.keys(WebClientEnvSchema.shape).sort());
		expect(keys.every((key: string): boolean => key.startsWith(PUBLIC_ENV_PREFIX))).toBe(true);
	});

	it("client env carries the parsed public values", () => {
		// Values come from vitest.config.ts `test.env`.
		expect(clientEnv.NEXT_PUBLIC_API_URL).toBe("http://api.test");
		expect(clientEnv.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
	});

	it("server env holds no public keys and reads NODE_ENV", () => {
		expect(Object.keys(serverEnv).some((key: string): boolean => key.startsWith(PUBLIC_ENV_PREFIX))).toBe(false);
		expect(serverEnv.NODE_ENV).toBe("test");
	});
});
