import { config as baseConfig } from "@workspace/eslint-config/base";

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
];

export default config;
