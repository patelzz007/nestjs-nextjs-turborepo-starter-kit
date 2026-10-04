import { nextJsConfig } from "@workspace/eslint-config/next-js";

/** @type {import("eslint").Linter.Config} */ export default [
	...nextJsConfig,
	{
		// ── Env boundary (docs/technical/configuration/frontend.md) ──────────────────────
		// `process.env` is read ONLY by the env modules, which validate it with
		// zod and split public (NEXT_PUBLIC_*) from server-only values.
		// Everything else imports `clientEnv` / `serverEnv` from lib/env/*.
		// env.runtime.ts only checks NEXT_RUNTIME (can this runtime exit?) for instrumentation.ts.
		files: ["**/*.ts", "**/*.tsx"],
		ignores: ["lib/env/env.client.ts", "lib/env/env.server.ts", "lib/env/env.runtime.ts", "e2e/env.e2e.ts", "e2e/browser-env.e2e.ts"],
		rules: {
			"no-restricted-properties": [
				"error",
				{
					object: "process",
					property: "env",
					message: "Read configuration through the validated env modules (lib/env/env.client.ts / env.server.ts), never process.env directly. See docs/technical/configuration/frontend.md.",
				},
			],
		},
	},
	{
		// The opt-in e2e smoke reads `ADMIN_E2E_BASE_URL` (see e2e/README.md). It is
		// a local-only switch that must not become part of any turbo task hash.
		files: ["e2e/**"],
		rules: {
			"turbo/no-undeclared-env-vars": "off",
		},
	},
];
