import { config as baseConfig } from "@workspace/oxlint-config/base";
import { composeConfigs } from "@workspace/oxlint-config/compose";
import { backendImportBoundaryConfig } from "@workspace/oxlint-config/import-boundaries";
import { NESTJS_NAMING_CONVENTION } from "@workspace/oxlint-config/nestjs";

/** packages/messaging: base rules, the NestJS conventions for its Nest module (src/nest), and the backend import boundaries. */
export default composeConfigs(baseConfig, {
	overrides: [
		{
			files: ["src/nest/**/*.ts"],
			rules: {
				"typescript/no-extraneous-class": "off",
				"require-await": "off",
				"typescript/require-await": "off",
				"workspace/naming-convention": ["error", ...NESTJS_NAMING_CONVENTION],
			},
		},
		backendImportBoundaryConfig,
	],
});
