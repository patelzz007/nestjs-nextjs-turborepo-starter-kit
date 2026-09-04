import { config as baseConfig } from "@workspace/eslint-config/base";

/**
 * Messaging package ESLint configuration.
 *
 * `src/nest/**` follows NestJS conventions (module shells, DI constructor params)
 * with the same relaxations as apps/api.
 */
const config = [
	...baseConfig,
	{
		files: ["src/nest/**/*.ts"],
		rules: {
			"@typescript-eslint/no-extraneous-class": "off",
			"require-await": "off",
			"@typescript-eslint/require-await": "off",
			"@typescript-eslint/naming-convention": [
				"error",
				{
					selector: "typeLike",
					format: ["PascalCase"],
				},
				{
					selector: "variable",
					format: ["camelCase", "PascalCase", "UPPER_CASE"],
				},
				{
					selector: "function",
					format: ["camelCase", "PascalCase"],
				},
				{
					selector: "memberLike",
					format: ["camelCase"],
				},
				{
					selector: "method",
					format: ["camelCase"],
				},
				{
					selector: ["objectLiteralProperty"],
					format: null,
				},
			],
		},
	},
];

export default config;
