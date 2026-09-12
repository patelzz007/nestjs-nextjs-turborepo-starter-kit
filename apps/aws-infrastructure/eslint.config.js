import { config as baseConfig } from "@workspace/eslint-config/base";

/**
 * AWS CDK infrastructure package.
 */
const config = [
	...baseConfig,
	{
		ignores: ["cdk.out/**"],
	},
	{
		files: ["bin/**/*.ts", "lib/**/*.ts"],
		rules: {
			"turbo/no-undeclared-env-vars": "off",
		},
	},
];

export default config;
