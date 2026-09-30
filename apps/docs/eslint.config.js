import { config as baseConfig } from "@workspace/eslint-config/base";

/**
 * The docs site is an Astro app: its logic lives in plain TypeScript modules
 * (`src/lib/**`, `src/scripts/**`), linted by the shared base config.
 * `.astro` templates are type-checked by `astro check` (the `typecheck` task).
 *
 * @type {import("eslint").Linter.Config}
 */
export default [
	...baseConfig,
	{
		// Build output and Astro's generated type stubs — generated code, not ours to lint.
		ignores: ["dist/**", ".astro/**"],
	},
];
