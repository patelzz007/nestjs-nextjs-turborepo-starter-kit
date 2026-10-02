import { EnvValidationError } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import { TEST_API_ENV } from "../../test/support/test-api-env";
import { getApiConfig, parseApiConfig } from "./api-config";

describe("parseApiConfig", () => {
	it("throws a value-free EnvValidationError scoped to apps/api", () => {
		const secret = "leaky-secret-value-that-must-not-print";
		const run = (): void => {
			parseApiConfig({ ...TEST_API_ENV, JWT_ACCESS_SECRET: secret.slice(0, 10) });
		};

		expect(run).toThrow(EnvValidationError);
		expect(run).toThrow(/Invalid environment configuration for apps\/api/);
		expect(run).not.toThrow(new RegExp(secret.slice(0, 10)));
	});

	it("ignores unrelated OS variables (PATH, HOME, …)", () => {
		expect(parseApiConfig({ ...TEST_API_ENV, PATH: "/usr/bin", SOME_OTHER_TOOL_FLAG: "x" }).runtime.appName).toBe("hello-world");
	});
});

describe("getApiConfig", () => {
	it("parses process.env once and returns the same validated object afterwards", () => {
		const first = getApiConfig();
		vi.stubEnv("APP_NAME", "changed-after-boot");
		try {
			expect(getApiConfig()).toBe(first);
			expect(getApiConfig().runtime.appName).toBe(TEST_API_ENV.APP_NAME);
		} finally {
			vi.unstubAllEnvs();
		}
	});
});
