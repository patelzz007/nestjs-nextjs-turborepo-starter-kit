import { config as baseConfig } from "@workspace/oxlint-config/base";
import { composeConfigs } from "@workspace/oxlint-config/compose";

/**
 * Shared package oxlint configuration.
 *
 * Zod v4 uses extremely complex generic type chains (e.g. `z.iso.datetime()`)
 * that the type-aware `no-unsafe-*` rules cannot resolve, producing false
 * positives. Since these are validated at runtime by Zod itself, the unsafe
 * rules are relaxed for schema files only. The non-negotiable rules (no `any`,
 * explicit return types, etc.) remain enforced everywhere.
 */
export default composeConfigs(baseConfig, {
	overrides: [
		{
			files: ["src/schemas/**/*.ts"],
			rules: {
				"typescript/no-unsafe-call": "off",
				"typescript/no-unsafe-member-access": "off",
				"typescript/no-unsafe-assignment": "off",
				"typescript/no-unsafe-argument": "off",
			},
		},
	],
});
