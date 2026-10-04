// ============================================
// instrumentation.ts - runs once when a Next.js server instance starts
// ============================================
// Validates configuration before the server accepts requests: importing the
// env modules parses them, and an invalid value raises an EnvValidationError
// naming every bad variable (values are never printed). Next.js only LOGS a
// failed `register()` and keeps serving 500s, so `loadEnvOrExit` prints the
// message and exits with code 1 in the Node.js runtime. The Edge runtime has
// no working `process.exit`; there the error is rethrown as before. See
// docs/technical/configuration/frontend.md. Imports stay inside `register` per the Next.js
// instrumentation guide, so all start-up side effects live in one place.

import { loadEnvOrExit } from "@workspace/shared";

async function loadEnvModules(): Promise<void> {
	await import("./lib/env/env.server");
	await import("./lib/env/env.client");
}

function reportEnvError(message: string): void {
	console.error(message);
}

export async function register(): Promise<void> {
	const { resolveProcessExit } = await import("./lib/env/env.runtime");
	await loadEnvOrExit({ loadEnv: loadEnvModules, exit: resolveProcessExit(), reportError: reportEnvError });
}
