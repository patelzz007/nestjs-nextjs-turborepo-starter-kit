/** Flat ESLint config for Node/TS workspace packages (CLI, shared, messaging, …). */
export function renderBaseWorkspaceEslintConfig(): string {
	return `import { config as baseConfig } from "@workspace/eslint-config/base";

/** @type {import("eslint").Linter.Config} */
const config = [
	...baseConfig,
	{
		ignores: ["src/**/*.js"],
	},
	{
		files: ["src/wizard/**/*.ts", "src/generators/**/*.ts", "src/core/manifest.ts"],
		rules: {
			"@typescript-eslint/consistent-type-assertions": "off",
			"@typescript-eslint/no-deprecated": "off",
			"@typescript-eslint/prefer-optional-chain": "off",
		},
	},
	{
		files: ["src/wizard/prompter.ts", "src/ui/clack-prompter.ts"],
		rules: {
			"@typescript-eslint/no-unnecessary-condition": "off",
		},
	},
	{
		files: ["src/validation/**/*.ts"],
		rules: {
			"require-await": "off",
			"@typescript-eslint/require-await": "off",
		},
	},
];

export default config;
`;
}
