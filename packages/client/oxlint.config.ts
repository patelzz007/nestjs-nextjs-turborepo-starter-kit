import { composeConfigs } from "@workspace/oxlint-config/compose";
import { clientOnlyWidgetsConfig, config } from "@workspace/oxlint-config/react-internal";
import { CLIENT_ONLY_WIDGETS } from "@workspace/ui/lib/client-only-widgets";

/** packages/client: the React library rules, its client-only widgets, and its env boundary (src/lib/api/config.ts). */
export default composeConfigs(config, {
	overrides: [
		clientOnlyWidgetsConfig(CLIENT_ONLY_WIDGETS),
		{
			files: ["**/*.ts", "**/*.tsx"],
			excludeFiles: ["src/lib/api/config.ts"],
			rules: {
				"no-restricted-properties": [
					"error",
					{
						object: "process",
						property: "env",
						message: "Read configuration through src/lib/api/config.ts (validated), never process.env directly. See docs/technical/configuration/frontend.md.",
					},
				],
			},
		},
	],
});
