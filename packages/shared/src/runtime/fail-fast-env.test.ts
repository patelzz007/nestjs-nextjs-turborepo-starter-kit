import { describe, expect, it, vi } from "vitest";

import { EnvValidationError, NextAppServerEnvSchema, parseEnvOrThrow } from "./app-env";
import { INVALID_ENV_EXIT_CODE, loadEnvOrExit, type ExitProcess, type LoadEnvOrExitOptions } from "./fail-fast-env";

const SCOPE = "apps/test (server-only config)";
/** A bad value that must never reach the error output. */
const LEAKY_COOKIE_DOMAIN = "https://secret-host.example:8443/path";

/** Rejects exactly like importing an env module with an invalid server variable. */
async function loadInvalidServerEnv(): Promise<void> {
	await Promise.resolve();
	parseEnvOrThrow(NextAppServerEnvSchema, { NODE_ENV: "production", COOKIE_DOMAIN: LEAKY_COOKIE_DOMAIN }, SCOPE);
}

async function loadValidServerEnv(): Promise<void> {
	await Promise.resolve();
	parseEnvOrThrow(NextAppServerEnvSchema, { NODE_ENV: "production", COOKIE_DOMAIN: ".example.com" }, SCOPE);
}

interface Harness {
	readonly exit: ReturnType<typeof vi.fn<ExitProcess>>;
	readonly reportError: ReturnType<typeof vi.fn<(message: string) => void>>;
	readonly options: LoadEnvOrExitOptions;
}

/** Node.js-like runtime: an exit function is available. */
function nodeHarness(loadEnv: () => Promise<void>): Harness {
	const exit = vi.fn<ExitProcess>();
	const reportError = vi.fn<(message: string) => void>();
	return { exit, reportError, options: { loadEnv, exit, reportError } };
}

/** Edge-like runtime: no exit function. */
function edgeHarness(loadEnv: () => Promise<void>): Omit<Harness, "exit"> {
	const reportError = vi.fn<(message: string) => void>();
	return { reportError, options: { loadEnv, exit: undefined, reportError } };
}

describe("loadEnvOrExit", () => {
	it("uses exit code 1 for invalid configuration", () => {
		expect(INVALID_ENV_EXIT_CODE).toBe(1);
	});

	it("exits with code 1 and prints the value-free message when the env is invalid", async () => {
		const { exit, reportError, options } = nodeHarness(loadInvalidServerEnv);

		await expect(loadEnvOrExit(options)).resolves.toBeUndefined();

		expect(exit).toHaveBeenCalledTimes(1);
		expect(exit).toHaveBeenCalledWith(INVALID_ENV_EXIT_CODE);
		expect(reportError).toHaveBeenCalledTimes(1);
		const message: string = reportError.mock.calls[0]?.[0] ?? "";
		expect(message).toContain(`Invalid environment configuration for ${SCOPE}:`);
		expect(message).toContain("COOKIE_DOMAIN: must be a bare host name");
		expect(message).toContain("Values are never printed.");
		expect(message).not.toContain(LEAKY_COOKIE_DOMAIN);
		expect(message).not.toContain("secret-host");
	});

	it("reports before exiting, so the message is written even though exit ends the process", async () => {
		const order: string[] = [];
		await loadEnvOrExit({
			loadEnv: loadInvalidServerEnv,
			exit: (): void => {
				order.push("exit");
			},
			reportError: (): void => {
				order.push("report");
			},
		});
		expect(order).toEqual(["report", "exit"]);
	});

	it("does nothing when the env is valid", async () => {
		const { exit, reportError, options } = nodeHarness(loadValidServerEnv);

		await expect(loadEnvOrExit(options)).resolves.toBeUndefined();

		expect(exit).not.toHaveBeenCalled();
		expect(reportError).not.toHaveBeenCalled();
	});

	it("rethrows instead of exiting when the runtime cannot exit (Edge)", async () => {
		const { reportError, options } = edgeHarness(loadInvalidServerEnv);

		await expect(loadEnvOrExit(options)).rejects.toBeInstanceOf(EnvValidationError);

		expect(reportError).not.toHaveBeenCalled();
	});

	it("does nothing on a runtime that cannot exit when the env is valid", async () => {
		const { reportError, options } = edgeHarness(loadValidServerEnv);

		await expect(loadEnvOrExit(options)).resolves.toBeUndefined();

		expect(reportError).not.toHaveBeenCalled();
	});

	it("rethrows errors that are not env validation failures without exiting", async () => {
		const failure = new Error("module failed to load");
		const { exit, reportError, options } = nodeHarness(async (): Promise<void> => {
			await Promise.resolve();
			throw failure;
		});

		await expect(loadEnvOrExit(options)).rejects.toBe(failure);

		expect(exit).not.toHaveBeenCalled();
		expect(reportError).not.toHaveBeenCalled();
	});
});
