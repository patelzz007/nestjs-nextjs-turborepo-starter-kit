// ============================================
// runtime/fail-fast-env.ts - Stop a Next.js server on invalid config
// ============================================
// `next start` / `next dev` call `instrumentation.ts` → `register()` before
// serving traffic, but Next only LOGS a rejected `register()` ("Failed to
// prepare server") and keeps the process alive, answering every request with
// a 500. `loadEnvOrExit` turns an `EnvValidationError` into a value-free
// message plus a non-zero exit instead, matching the API's fail-fast startup.
//
// Framework-agnostic and side-effect free: the caller injects the loader, the
// exit function and the error sink, so this file never touches `process`
// (and is safe to sit in the shared, browser-importable package). See
// docs/technical/configuration/frontend.md → "How validation fails".

import { EnvValidationError } from "./app-env";

/** Conventional "configuration error" process exit status (any non-zero fails the deploy). */
export const INVALID_ENV_EXIT_CODE = 1;

/** Terminates the current process with `code` (`process.exit` in Node.js). */
export type ExitProcess = (code: number) => void;

export interface LoadEnvOrExitOptions {
	/** Imports / parses the app's env modules; rejects with `EnvValidationError` when invalid. */
	readonly loadEnv: () => Promise<void>;
	/**
	 * How to terminate the process, or `undefined` where the runtime cannot
	 * exit (Next.js's Edge runtime, whose `process.exit` throws). Apps obtain
	 * it from `lib/env/env.runtime.ts`.
	 */
	readonly exit: ExitProcess | undefined;
	/** Writes the value-free failure message (`console.error` in apps). */
	readonly reportError: (message: string) => void;
}

/**
 * Runs `loadEnv`. When it fails with an `EnvValidationError` and `exit` is
 * available, the error's message (it names variables, never values) is
 * reported and the process exits with {@link INVALID_ENV_EXIT_CODE}. Without
 * an `exit` the error is rethrown unchanged, as is any error that is not an
 * env validation failure.
 */
export async function loadEnvOrExit(options: LoadEnvOrExitOptions): Promise<void> {
	try {
		await options.loadEnv();
	} catch (error) {
		if (options.exit === undefined || !(error instanceof EnvValidationError)) {
			throw error;
		}
		options.reportError(error.message);
		options.exit(INVALID_ENV_EXIT_CODE);
	}
}
