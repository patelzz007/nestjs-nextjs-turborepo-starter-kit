import { API_VERSION_PREFIX, EnvValidationError } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { API_BASE_URL, API_URL_PREFIX, RUNTIME_NODE_ENV } from "./config";

describe("api config (the package env module)", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it("exposes the validated API base URL", () => {
		// Fixture from vitest.config.ts `test.env`.
		expect(API_BASE_URL).toBe("http://api.test");
	});

	it("exposes the NODE_ENV the bundle runs under", () => {
		expect(RUNTIME_NODE_ENV).toBe("test");
	});

	it("uses the shared contract's version prefix", () => {
		expect(API_URL_PREFIX).toBe(API_VERSION_PREFIX);
	});

	it("strips a trailing slash from the API base URL", async () => {
		vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com/");
		vi.resetModules();
		const reloaded = await import("./config");
		expect(reloaded.API_BASE_URL).toBe("https://api.example.com");
	});

	it("fails fast, naming the variable, when NEXT_PUBLIC_API_URL is missing", async () => {
		vi.stubEnv("NEXT_PUBLIC_API_URL", "");
		vi.resetModules();
		// `resetModules` re-evaluates @workspace/shared too, so compare by name
		// rather than `instanceof` against this file's copy of the class.
		await expect(import("./config")).rejects.toMatchObject({
			name: EnvValidationError.name,
			issues: [{ variable: "NEXT_PUBLIC_API_URL", problem: "is required but not set" }],
		});
	});

	it("rejects a non-http(s) API URL without echoing it", async () => {
		const badValue = "ftp://private-host.internal";
		vi.stubEnv("NEXT_PUBLIC_API_URL", badValue);
		vi.resetModules();
		const failure: Promise<typeof import("./config")> = import("./config");
		await expect(failure).rejects.toThrow(/NEXT_PUBLIC_API_URL: must be an absolute http:\/\/ or https:\/\/ URL/);
		await expect(failure).rejects.not.toThrow(badValue);
	});
});
