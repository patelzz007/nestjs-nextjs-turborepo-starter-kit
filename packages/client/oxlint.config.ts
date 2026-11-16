import { composeConfigs } from "@workspace/oxlint-config/compose";
import { FRONTEND_RESTRICTED_IMPORT_PATTERNS, UNIVERSAL_RESTRICTED_IMPORT_PATTERNS } from "@workspace/oxlint-config/import-boundaries";
import { clientOnlyWidgetsConfig, config } from "@workspace/oxlint-config/react-internal";
import { CLIENT_ONLY_WIDGETS } from "@workspace/ui/lib/client-only-widgets";

/** packages/client: the React library rules, its client-only widgets, its env boundary (src/lib/api/config.ts) and the one `useRouter` wrapper. */
export default composeConfigs(config, {
	overrides: [
		clientOnlyWidgetsConfig(CLIENT_ONLY_WIDGETS),
		// The one wrapper around the App Router's `useRouter`: every app navigates in code through it.
		{
			files: ["src/lib/navigation/use-progress-router.ts"],
			rules: {
				"workspace/restricted-imports": ["error", { patterns: [...UNIVERSAL_RESTRICTED_IMPORT_PATTERNS, ...FRONTEND_RESTRICTED_IMPORT_PATTERNS] }],
			},
		},
		{
			files: ["**/*.ts", "**/*.tsx"],
			excludeFiles: ["src/lib/api/config.ts", "src/lib/env/env-runtime.ts"],
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
