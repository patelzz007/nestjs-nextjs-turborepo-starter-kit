import { config as baseConfig } from "@workspace/oxlint-config/base";
import { composeConfigs } from "@workspace/oxlint-config/compose";

/** apps/aws-infrastructure: base rules; the CDK app reads deployment env vars turbo.json does not list. */
export default composeConfigs(baseConfig, {
	ignorePatterns: ["cdk.out/**"],
	overrides: [
		{
			files: ["bin/**/*.ts", "lib/**/*.ts"],
			rules: { "turbo/no-undeclared-env-vars": "off" },
		},
	],
});
