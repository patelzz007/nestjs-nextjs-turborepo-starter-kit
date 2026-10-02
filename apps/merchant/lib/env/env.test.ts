import { EnvValidationError, parseEnvOrThrow, PUBLIC_ENV_PREFIX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { clientEnv } from "./env.client";
import { MERCHANT_ENV_SCOPE, MerchantClientEnvSchema, MerchantServerEnvSchema } from "./env.schema";
import { serverEnv } from "./env.server";

const VALID_PUBLIC_SOURCE: Readonly<Record<string, string>> = {
	NEXT_PUBLIC_API_URL: "https://api.example.com",
	NEXT_PUBLIC_MERCHANT_URL: "https://merchant.example.com",
};

describe("MerchantClientEnvSchema", () => {
	it("declares only NEXT_PUBLIC_* keys", () => {
		const keys: string[] = Object.keys(MerchantClientEnvSchema.shape);
		expect(keys.length).toBeGreaterThan(0);
		expect(keys.filter((key: string): boolean => !key.startsWith(PUBLIC_ENV_PREFIX))).toEqual([]);
	});

	it("defaults the demo-accounts flag to off", () => {
		expect(parseEnvOrThrow(MerchantClientEnvSchema, VALID_PUBLIC_SOURCE, MERCHANT_ENV_SCOPE.client).NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS).toBe(false);
	});

	it("names every missing required variable without printing values", () => {
		const run = (): void => {
			parseEnvOrThrow(MerchantClientEnvSchema, { NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS: "true" }, MERCHANT_ENV_SCOPE.client);
		};
		expect(run).toThrow(EnvValidationError);
		expect(run).toThrow(/NEXT_PUBLIC_API_URL: is required but not set/);
		expect(run).toThrow(/NEXT_PUBLIC_MERCHANT_URL: is required but not set/);
	});

	it("rejects a non-URL API base", () => {
		expect(MerchantClientEnvSchema.safeParse({ ...VALID_PUBLIC_SOURCE, NEXT_PUBLIC_API_URL: "api.example.com" }).success).toBe(false);
	});
});

describe("MerchantServerEnvSchema", () => {
	it("requires NODE_ENV and leaves COOKIE_DOMAIN optional", () => {
		expect(MerchantServerEnvSchema.parse({ NODE_ENV: "production" })).toEqual({ NODE_ENV: "production", COOKIE_DOMAIN: undefined });
		expect(MerchantServerEnvSchema.safeParse({}).success).toBe(false);
	});
});

describe("env modules", () => {
	it("client env exposes only NEXT_PUBLIC_* keys", () => {
		const keys: string[] = Object.keys(clientEnv);
		expect(keys.sort()).toEqual(Object.keys(MerchantClientEnvSchema.shape).sort());
		expect(keys.every((key: string): boolean => key.startsWith(PUBLIC_ENV_PREFIX))).toBe(true);
	});

	it("client env carries the parsed public values", () => {
		// Values come from vitest.config.ts `test.env`.
		expect(clientEnv.NEXT_PUBLIC_API_URL).toBe("http://api.test");
		expect(clientEnv.NEXT_PUBLIC_MERCHANT_URL).toBe("http://localhost:3003");
	});

	it("server env holds no public keys and reads NODE_ENV", () => {
		expect(Object.keys(serverEnv).some((key: string): boolean => key.startsWith(PUBLIC_ENV_PREFIX))).toBe(false);
		expect(serverEnv.NODE_ENV).toBe("test");
	});
});
