import { config as baseConfig } from "@workspace/eslint-config/base";
import { backendImportBoundaryConfig } from "@workspace/eslint-config/import-boundaries";

/**
 * Standalone Kafka worker — stdout logging for boot, subscribe, and shutdown is intentional.
 *
 * @type {import("eslint").Linter.Config}
 */
const config = [
	...baseConfig,
	{
		files: ["src/**/*.ts"],
		rules: {
			"no-console": ["warn", { allow: ["log", "warn", "error"] }],
		},
	},

	// ── Import boundaries: a Node worker never imports frontend code ──
	// (@workspace/client, @workspace/ui, next, react, react-dom) — same block as apps/api.
	backendImportBoundaryConfig,

	// ── Env boundary: only src/env.ts reads process.env (validated with zod) ──
	{
		files: ["src/**/*.ts"],
		ignores: ["src/env.ts"],
		rules: {
			"no-restricted-properties": [
				"error",
				{
					object: "process",
					property: "env",
					message: "Read configuration through loadConsumerEnv() (src/env.ts), never process.env directly.",
				},
			],
		},
	},
];

export default config;
