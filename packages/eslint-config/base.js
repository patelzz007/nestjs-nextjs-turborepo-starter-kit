import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
// eslint-plugin-import v2 is CJS — handle default export interop for ESM
import eslintPluginImportDef from "eslint-plugin-import";
const eslintPluginImport = eslintPluginImportDef.default ?? eslintPluginImportDef;
import eslintPluginPrettier from "eslint-plugin-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";
import globals from "globals";

/**
 * A shared ESLint configuration for the repository.
 *
 * Applies to ALL repos: web, admin, api, and packages.
 *
 * @see https://typescript-eslint.io/users/configs
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
	// ── 1. Recommended JS rules ────────────────────────────────────
	js.configs.recommended,

	// ── 1b. Register the typescript-eslint plugin globally ─────────
	// The strictTypeChecked/stylisticTypeChecked configs below only register
	// the plugin inside TS-scoped config objects. Later config blocks in this
	// file reference `@typescript-eslint/*` rules with NO `files` restriction,
	// so those blocks also apply to non-TS files (e.g. our `scripts/*.mjs`).
	// Without a global registration, ESLint fails with "could not find plugin
	// @typescript-eslint" the moment any non-TS file is linted.
	{
		plugins: {
			"@typescript-eslint": tseslint.plugin,
		},
	},

	// ── 2. Turn off rules that conflict with Prettier ──────────────
	eslintConfigPrettier,

	// ── 2b. Node globals for repo script files ─────────────────────
	// scripts/*.mjs (build fixers, dev runners) run on Node, so give them the
	// Node global environment instead of the browser defaults.
	{
		files: ["**/*.mjs", "**/*.cjs", "**/scripts/**/*.js"],
		languageOptions: {
			globals: globals.node,
		},
	},

	// ── 3. TypeScript strict type-checked rules ────────────────────
	// Catches: null/undefined misuse, promise handling, unsafe access, type narrowing gaps.
	// Requires projectService so each app's own tsconfig.json is used.
	...tseslint.configs.strictTypeChecked.map((config) => ({
		...config,
		files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
	})),

	// ── 4. TypeScript stylistic type-checked rules ────────────────
	// Consistent type style: prefer interfaces, explicit void return, no {} as type.
	...tseslint.configs.stylisticTypeChecked.map((config) => ({
		...config,
		files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
	})),

	// ── 5. TypeScript parser options (required for type-checked rules) ─
	{
		files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
		languageOptions: {
			parserOptions: {
				projectService: true,
			},
		},
	},

	// ── 6. Import validation ────────────────────────────────────────
	// Note: `import/order` and `import/newline-after-import` were intentionally
	// removed (per the team's request) — the team prefers to let Prettier handle
	// import formatting. `import/no-duplicates` and `import/first` are kept.
	{
		plugins: {
			import: eslintPluginImport,
		},
		rules: {
			"import/no-duplicates": "error",
			"import/first": "error",
		},
	},

	// ── 7. Naming conventions (TypeScript strict) ──────────────────
	// Scoped to TS files: these rules need parserServices (typed linting) and
	// crash on plain JS/MJS files (e.g. scripts/*.mjs).
	{
		files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
		rules: {
			"@typescript-eslint/naming-convention": [
				"error",
				// Types, interfaces, enums, type aliases → PascalCase
				{
					selector: "typeLike",
					format: ["PascalCase"],
				},
				// Variables → camelCase, UPPER_CASE, or PascalCase (Zod schemas, JSX const components)
				{
					selector: "variable",
					format: ["camelCase", "PascalCase", "UPPER_CASE"],
				},
				// Functions → camelCase (regular) or PascalCase (React components)
				{
					selector: "function",
					format: ["camelCase", "PascalCase"],
				},
				// Class members → camelCase
				{
					selector: "memberLike",
					format: ["camelCase"],
				},
				// Class methods, accessors → camelCase
				{
					selector: "method",
					format: ["camelCase"],
				},
				// Enforce that private members start with underscore
				{
					selector: "memberLike",
					modifiers: ["private"],
					format: ["camelCase"],
					leadingUnderscore: "require",
				},
				// Allow `_count` and similar Prisma-style meta properties (no naming enforcement)
				{
					selector: ["objectLiteralProperty"],
					filter: { regex: "^_", match: true },
					format: null,
				},
				// Allow any format for object literal properties (CSS class names in cva variants,
				// API response field names, config objects with non-standard keys like `icon-sm`)
				{
					selector: ["objectLiteralProperty"],
					format: null,
				},
				// Allow PascalCase for object literal methods (used by shadcn calendar/DayPicker)
				{
					selector: ["objectLiteralMethod"],
					format: ["PascalCase", "camelCase"],
				},
			],
		},
	},

	// ── 8. Safety & quality rules ───────────────────────────────────
	// The @typescript-eslint/* rules need parserServices, so the whole block is
	// scoped to TS files. (js.configs.recommended still covers plain JS.)
	{
		files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
		rules: {
			// Require === and !== over == and !=, but allow `== null` / `!= null`
			// null-checks (idiomatic way to check for both null and undefined).
			"eqeqeq": ["error", "always", { "null": "ignore" }],

			// No unused variables (prefix with _ to ignore)
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					destructuredArrayIgnorePattern: "^_",
					ignoreRestSiblings: true,
				},
			],

			// Warn on console.log (use a proper logger instead)
			"no-console": ["warn", { allow: ["warn", "error"] }],

			// No debugger statements
			"no-debugger": "error",

			// No empty blocks (allow empty catch with comment)
			"no-empty": ["error", { allowEmptyCatch: true }],

			// No async function without await
			"require-await": "error",

			// Return/await in try/catch — ensures errors aren't swallowed
			"@typescript-eslint/return-await": ["error", "in-try-catch"],

			// Prefer readonly for arrays that are never modified
			"@typescript-eslint/prefer-readonly": "warn",

			// No unnecessary conditions
			"@typescript-eslint/no-unnecessary-condition": "error",

			// No unnecessary boolean comparisons
			"@typescript-eslint/no-unnecessary-boolean-literal-compare": "error",

			// No redundant type annotations
			"@typescript-eslint/no-inferrable-types": "error",
		},
	},

	// ── 9. Non-negotiable: explicit type casting ban (Rule #4) ────
	//    Only bans `as Type` and `<Type>value` assertions.
	//    `as const` is NOT banned because it is not a type cast — it narrows
	//    literal types for better type inference (required by cva, shadcn,
	//    and constant tuple patterns).
	{
		files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
		rules: {
			// No type assertions — use Zod inference or proper types.
			// NOTE: `as const` is automatically exempted from this rule.
			// For CSS custom properties (e.g. `{ "--color-bg": value }`), use the
			// `satisfies React.CSSProperties & Record<string, string>` pattern instead
			// of `as React.CSSProperties` — `satisfies` is not a type cast.
			"@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
		},
	},

	// ── 10. Non-negotiable: explicit return types (Rule #15) ──────
	{
		files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
		rules: {
			// No explicit `any` — use proper types (derived from Zod where possible)
			"@typescript-eslint/no-explicit-any": "error",

			"@typescript-eslint/explicit-function-return-type": "error",
			"@typescript-eslint/explicit-member-accessibility": "error",
		},
	},

	// ── 11. Turbo plugin ───────────────────────────────────────────
	{
		plugins: {
			turbo: turboPlugin,
		},
		rules: {
			"turbo/no-undeclared-env-vars": "warn",
		},
	},

	// ── 12. Prettier integration ───────────────────────────────────
	{
		plugins: {
			prettier: eslintPluginPrettier,
		},
		rules: {
			"prettier/prettier": [
				"error",
				{},
				{
					usePrettierrc: true,
				},
			],
		},
	},

	// ── 13. Ignore patterns ────────────────────────────────────────
	{
		ignores: [
			"dist/**",
			".next/**",
			"**/.turbo/**",
			"**/coverage/**",
			"**/node_modules/**",
			"*.config.*",
			"**/*.d.ts",
			"**/prisma/**",
		],
	},
];
