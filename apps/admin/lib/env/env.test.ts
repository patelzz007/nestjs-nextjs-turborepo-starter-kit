import { EnvValidationError, parseEnvOrThrow, PUBLIC_ENV_PREFIX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { clientEnv } from "./env.client";
import { ADMIN_ENV_SCOPE, AdminClientEnvSchema, AdminServerEnvSchema } from "./env.schema";
import { serverEnv } from "./env.server";

const VALID_PUBLIC_SOURCE: Readonly<Record<string, string>> = {
	NEXT_PUBLIC_API_URL: "https://api.example.com",
	NEXT_PUBLIC_ADMIN_URL: "https://admin.example.com",
	NEXT_PUBLIC_WEB_URL: "https://www.example.com",
	NEXT_PUBLIC_MERCHANT_URL: "https://merchant.example.com",
};

function parsePublic(overrides: Readonly<Record<string, string | undefined>>): ReturnType<typeof AdminClientEnvSchema.parse> {
	return parseEnvOrThrow(AdminClientEnvSchema, { ...VALID_PUBLIC_SOURCE, ...overrides }, ADMIN_ENV_SCOPE.client);
}

describe("AdminClientEnvSchema", () => {
	it("declares only NEXT_PUBLIC_* keys", () => {
		const keys: string[] = Object.keys(AdminClientEnvSchema.shape);
		expect(keys.length).toBeGreaterThan(0);
		expect(keys.filter((key: string): boolean => !key.startsWith(PUBLIC_ENV_PREFIX))).toEqual([]);
	});

	it("defaults the demo flag to off and steady polling to disabled", () => {
		const env = parsePublic({});
		expect(env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS).toBe(false);
		expect(env.NEXT_PUBLIC_SESSION_POLL_MS).toBeNull();
	});

	it("disables steady polling for empty, whitespace-only and 0 values", () => {
		expect(parsePublic({ NEXT_PUBLIC_SESSION_POLL_MS: "" }).NEXT_PUBLIC_SESSION_POLL_MS).toBeNull();
		expect(parsePublic({ NEXT_PUBLIC_SESSION_POLL_MS: "   " }).NEXT_PUBLIC_SESSION_POLL_MS).toBeNull();
		expect(parsePublic({ NEXT_PUBLIC_SESSION_POLL_MS: "0" }).NEXT_PUBLIC_SESSION_POLL_MS).toBeNull();
	});

	it("parses a positive steady-poll interval", () => {
		expect(parsePublic({ NEXT_PUBLIC_SESSION_POLL_MS: "60000" }).NEXT_PUBLIC_SESSION_POLL_MS).toBe(60_000);
		expect(parsePublic({ NEXT_PUBLIC_SESSION_POLL_MS: " 300000 " }).NEXT_PUBLIC_SESSION_POLL_MS).toBe(300_000);
	});

	it("fails fast on a malformed steady-poll interval instead of silently disabling it", () => {
		expect(() => parsePublic({ NEXT_PUBLIC_SESSION_POLL_MS: "abc" })).toThrow(/NEXT_PUBLIC_SESSION_POLL_MS: must be a whole number/);
		expect(() => parsePublic({ NEXT_PUBLIC_SESSION_POLL_MS: "-5" })).toThrow(EnvValidationError);
	});

	it("names every missing origin without printing values", () => {
		const run = (): void => {
			parseEnvOrThrow(AdminClientEnvSchema, { NEXT_PUBLIC_API_URL: "https://api.example.com" }, ADMIN_ENV_SCOPE.client);
		};
		expect(run).toThrow(/NEXT_PUBLIC_ADMIN_URL: is required but not set/);
		expect(run).toThrow(/NEXT_PUBLIC_WEB_URL: is required but not set/);
		expect(run).toThrow(/NEXT_PUBLIC_MERCHANT_URL: is required but not set/);
		expect(run).not.toThrow(/api\.example\.com/);
	});
});

describe("AdminServerEnvSchema", () => {
	it("requires NODE_ENV and leaves COOKIE_DOMAIN optional", () => {
		expect(AdminServerEnvSchema.parse({ NODE_ENV: "development" })).toEqual({ NODE_ENV: "development", COOKIE_DOMAIN: undefined });
		expect(AdminServerEnvSchema.safeParse({ COOKIE_DOMAIN: "localhost" }).success).toBe(false);
	});
});

describe("env modules", () => {
	it("client env exposes only NEXT_PUBLIC_* keys", () => {
		const keys: string[] = Object.keys(clientEnv);
		expect(keys.sort()).toEqual(Object.keys(AdminClientEnvSchema.shape).sort());
		expect(keys.every((key: string): boolean => key.startsWith(PUBLIC_ENV_PREFIX))).toBe(true);
	});

	it("client env carries the parsed public values", () => {
		// Values come from vitest.config.ts `test.env`.
		expect(clientEnv.NEXT_PUBLIC_ADMIN_URL).toBe("http://localhost:3001");
		expect(clientEnv.NEXT_PUBLIC_WEB_URL).toBe("http://localhost:3000");
		expect(clientEnv.NEXT_PUBLIC_MERCHANT_URL).toBe("http://localhost:3003");
	});

	it("server env holds no public keys and reads NODE_ENV", () => {
		expect(Object.keys(serverEnv).some((key: string): boolean => key.startsWith(PUBLIC_ENV_PREFIX))).toBe(false);
		expect(serverEnv.NODE_ENV).toBe("test");
	});
});
