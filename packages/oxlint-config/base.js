import { defineConfig } from "oxlint";

import { universalImportBoundaryConfig } from "./import-boundaries.js";
import { TURBO_PLUGIN, WORKSPACE_PLUGIN } from "./js-plugins.js";
import { restrictedSyntaxRules } from "./restricted-syntax-rules.js";
import { javascriptRules } from "./rules/javascript.js";
import { typescriptRules } from "./rules/typescript.js";

/**
 * The shared oxlint configuration every workspace composes (directly, or
 * through react-internal / next / nestjs / react-native) with `composeConfigs`
 * — never oxlint's `extends`, which drops env, globals, settings and ignores.
 *
 * - Every category is off: the rule set is exactly the explicit lists in
 *   `rules/` (translated from the ESLint configuration this package replaced),
 *   so an oxlint upgrade that adds rules to a category never changes the gate.
 * - Type-aware rules run through oxlint-tsgolint (TypeScript 7), against the
 *   nearest tsconfig of each file.
 * - The repository's own rules (`workspace/*`) come from `./plugin`; `turbo/*`
 *   from eslint-plugin-turbo as a JS plugin.
 *
 * Formatting is not a lint rule any more: every workspace's `lint` script runs
 * `oxfmt --check` before oxlint.
 */

/** Every linted source file. */
export const SOURCE_FILES = ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts", "**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"];

/** TypeScript source files. */
export const TYPESCRIPT_FILES = ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"];

/** JavaScript source files. */
export const JAVASCRIPT_FILES = ["**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"];

/** Files that run on Node: repository scripts and tool configs. */
const NODE_SCRIPT_FILES = ["**/*.mjs", "**/*.cjs", "**/scripts/**/*.js"];

/**
 * The naming rules (rules/00). Private members carry a leading underscore;
 * object-literal keys are free (API field names, CSS class keys, Prisma
 * operators); object-literal methods may be PascalCase (DayPicker slots).
 */
export const NAMING_CONVENTION = [
	{ selector: "typeLike", format: ["PascalCase"] },
	{ selector: "variable", format: ["camelCase", "PascalCase", "UPPER_CASE"] },
	{ selector: "function", format: ["camelCase", "PascalCase"] },
	{ selector: "memberLike", format: ["camelCase"] },
	{ selector: "method", format: ["camelCase"] },
	{ selector: "memberLike", modifiers: ["private"], format: ["camelCase"], leadingUnderscore: "require" },
	{ selector: ["objectLiteralProperty"], filter: { regex: "^_", match: true }, format: null },
	{ selector: ["objectLiteralProperty"], format: null },
	{ selector: ["objectLiteralMethod"], format: ["PascalCase", "camelCase"] },
];

export const config = defineConfig({
	plugins: ["eslint", "typescript", "unicorn", "oxc", "import"],
	jsPlugins: [WORKSPACE_PLUGIN, TURBO_PLUGIN],
	categories: {
		correctness: "off",
		suspicious: "off",
		pedantic: "off",
		perf: "off",
		style: "off",
		restriction: "off",
		nursery: "off",
	},
	options: {
		typeAware: true,
		reportUnusedDisableDirectives: "error",
	},
	env: {
		builtin: true,
	},
	ignorePatterns: ["dist/**", ".next/**", "**/.turbo/**", "**/coverage/**", "**/node_modules/**", "*.config.*", "**/*.d.ts", "**/prisma/**"],
	overrides: [
		{
			files: JAVASCRIPT_FILES,
			rules: javascriptRules,
		},
		{
			files: NODE_SCRIPT_FILES,
			env: { node: true },
		},
		{
			files: TYPESCRIPT_FILES,
			rules: {
				...typescriptRules,
				"workspace/naming-convention": ["error", ...NAMING_CONVENTION],
				"workspace/restricted-syntax": restrictedSyntaxRules,
			},
		},
		universalImportBoundaryConfig,
	],
});
