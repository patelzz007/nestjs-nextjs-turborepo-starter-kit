// ============================================
// instrumentation.test.ts - start-up config gate wiring
// ============================================
// Each case re-imports instrumentation (and so the env modules) with a
// stubbed environment. `process.exit` is replaced by a throwing spy so the
// test process survives and the exit code can be asserted. A fresh module graph per
// case means a fresh EnvValidationError class, so failures are matched by message.

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import { MERCHANT_ENV_SCOPE } from "./lib/env/env.schema";

/** A bad value that must never reach the error output. */
const LEAKY_COOKIE_DOMAIN = "https://leaky-cookie-host.example:8443";

class ProcessExitCalled extends Error {
	public readonly code: number | string | null | undefined;

	public constructor(code: number | string | null | undefined) {
		super(`process.exit(${String(code)})`);
		this.name = "ProcessExitCalled";
		this.code = code;
	}
}

let exitSpy: MockInstance<typeof process.exit>;
let errorSpy: MockInstance<typeof console.error>;

async function runRegister(): Promise<void> {
	vi.resetModules();
	const { register } = await import("./instrumentation");
	await register();
}

beforeEach((): void => {
	exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
		throw new ProcessExitCalled(code);
	});
	errorSpy = vi.spyOn(console, "error").mockImplementation((): void => undefined);
});

afterEach((): void => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("instrumentation register()", () => {
	it("starts normally with a valid env on the Node.js runtime", async () => {
		vi.stubEnv("NEXT_RUNTIME", "nodejs");
		await expect(runRegister()).resolves.toBeUndefined();
		expect(exitSpy).not.toHaveBeenCalled();
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it("exits with code 1 and a value-free message when a server variable is invalid (Node.js runtime)", async () => {
		vi.stubEnv("NEXT_RUNTIME", "nodejs");
		vi.stubEnv("COOKIE_DOMAIN", LEAKY_COOKIE_DOMAIN);

		await expect(runRegister()).rejects.toBeInstanceOf(ProcessExitCalled);

		expect(exitSpy).toHaveBeenCalledWith(1);
		expect(errorSpy).toHaveBeenCalledTimes(1);
		const message = String(errorSpy.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]);
		expect(message).toContain(`Invalid environment configuration for ${MERCHANT_ENV_SCOPE.server}:`);
		expect(message).toContain("COOKIE_DOMAIN:");
		expect(message).not.toContain(LEAKY_COOKIE_DOMAIN);
		expect(message).not.toContain("leaky-cookie-host");
	});

	it("never calls process.exit on the Edge runtime and rethrows the validation error instead", async () => {
		vi.stubEnv("NEXT_RUNTIME", "edge");
		vi.stubEnv("COOKIE_DOMAIN", LEAKY_COOKIE_DOMAIN);

		await expect(runRegister()).rejects.toThrow(`Invalid environment configuration for ${MERCHANT_ENV_SCOPE.server}:`);

		expect(exitSpy).not.toHaveBeenCalled();
	});

	it("never calls process.exit outside Next (NEXT_RUNTIME unset)", async () => {
		vi.stubEnv("COOKIE_DOMAIN", LEAKY_COOKIE_DOMAIN);

		await expect(runRegister()).rejects.toThrow(`Invalid environment configuration for ${MERCHANT_ENV_SCOPE.server}:`);

		expect(exitSpy).not.toHaveBeenCalled();
	});
});
