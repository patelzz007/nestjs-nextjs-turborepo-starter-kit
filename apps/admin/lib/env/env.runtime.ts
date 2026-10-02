// ============================================
// lib/env/env.runtime.ts - apps/admin start-up runtime capabilities
// ============================================
// `instrumentation.ts` runs in every server runtime. An invalid config may
// terminate the process only in the Node.js runtime: the Edge sandbox's
// `process.exit` throws. This module is the one place that asks which
// runtime is running, so it sits with the other env modules (the only files
// allowed to read `process.env`; see docs/configuration.md).
//
// `NEXT_RUNTIME` is not operator configuration: Next.js itself inlines it
// ("nodejs" / "edge") into each server bundle at build time and leaves it
// unset elsewhere (browser, Vitest). The comparison below is therefore
// written as a literal, so the Edge bundle folds it to `false` and drops the
// branch, including its `process.exit` reference, entirely.

import "server-only";

import type { ExitProcess } from "@workspace/shared";

/** `process.exit` in the Node.js runtime; `undefined` in the Edge runtime and outside Next. */
export function resolveProcessExit(): ExitProcess | undefined {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		return (code: number): void => {
			process.exit(code);
		};
	}
	return undefined;
}
