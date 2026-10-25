import { config as baseConfig } from "@workspace/oxlint-config/base";
import { composeConfigs } from "@workspace/oxlint-config/compose";
import { backendImportBoundaryConfig } from "@workspace/oxlint-config/import-boundaries";

/**
 * apps/analytics-consumer: base rules, a CLI that may print to stdout, the backend
 * import boundaries, and the env boundary (only src/infrastructure/env.ts reads process.env).
 */
export default composeConfigs(baseConfig, {
	overrides: [
		{
			files: ["src/**/*.ts"],
			rules: { "no-console": ["error", { allow: ["log", "warn", "error"] }] },
		},
		backendImportBoundaryConfig,
		{
			files: ["src/**/*.ts"],
			excludeFiles: ["src/infrastructure/env.ts"],
			rules: {
				"no-restricted-properties": [
					"error",
					{
						object: "process",
						property: "env",
						message: "Read configuration through loadConsumerEnv() (src/infrastructure/env.ts), never process.env directly.",
					},
				],
			},
		},
	],
});
