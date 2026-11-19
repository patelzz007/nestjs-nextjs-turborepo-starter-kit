import { afterEach, describe, expect, it, vi } from "vitest";

import { runGracefulShutdown, type GracefulShutdownDependencies } from "../graceful-shutdown";

const SHUTDOWN_TIMEOUT_MS = 15_000;

interface Recorder {
	readonly steps: string[];
	readonly deps: GracefulShutdownDependencies;
	readonly exit: ReturnType<typeof vi.fn<(code: number) => void>>;
	readonly error: ReturnType<typeof vi.fn<(message: string) => void>>;
}

function recorder(overrides: { readonly close?: () => Promise<void> } = {}): Recorder {
	const steps: string[] = [];
	const exit = vi.fn<(code: number) => void>((code: number): void => {
		steps.push(`exit:${String(code)}`);
	});
	const error = vi.fn<(message: string) => void>();
	const deps: GracefulShutdownDependencies = {
		app: {
			close:
				overrides.close ??
				((): Promise<void> => {
					steps.push("close");
					return Promise.resolve();
				}),
		},
		readiness: {
			markNotReady: (): void => {
				steps.push("not-ready");
			},
		},
		log: { info: vi.fn<(message: string) => void>(), error },
		shutdownTimeoutMs: SHUTDOWN_TIMEOUT_MS,
		exit,
	};
	return { steps, deps, exit, error };
}

describe("runGracefulShutdown", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("leaves the load balancer's rotation first, then closes the application, then exits 0", async () => {
		const { steps, deps } = recorder();

		await runGracefulShutdown("SIGTERM", deps);

		expect(steps).toEqual(["not-ready", "close", "exit:0"]);
	});

	it("exits 1 when closing the application fails", async () => {
		const { steps, deps, error } = recorder({ close: (): Promise<void> => Promise.reject(new Error("redis down")) });

		await runGracefulShutdown("SIGINT", deps);

		expect(steps).toEqual(["not-ready", "exit:1"]);
		expect(error).toHaveBeenCalledWith("Graceful shutdown failed: redis down");
	});

	it("forces exit 1 when shutdown outlives the timeout", async () => {
		vi.useFakeTimers();
		const { deps, exit } = recorder({ close: (): Promise<void> => new Promise<void>((): void => undefined) });

		void runGracefulShutdown("SIGTERM", deps);
		await vi.advanceTimersByTimeAsync(SHUTDOWN_TIMEOUT_MS);

		expect(exit).toHaveBeenCalledExactlyOnceWith(1);
	});
});
