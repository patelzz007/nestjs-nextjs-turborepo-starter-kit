import { composeConfigs } from "@workspace/oxlint-config/compose";
import { nextJsConfig } from "@workspace/oxlint-config/next-js";
import { clientOnlyWidgetsConfig } from "@workspace/oxlint-config/react-internal";
import { CLIENT_ONLY_WIDGETS } from "@workspace/ui/lib/client-only-widgets";

/**
 * apps/merchant: the shared Next.js config, the client-only widgets this app renders
 * (decision #58), and the env boundary — `process.env` is read only by the validated
 * env modules (docs/technical/configuration/frontend.md).
 */
export default composeConfigs(nextJsConfig, {
	overrides: [
		clientOnlyWidgetsConfig(CLIENT_ONLY_WIDGETS),
		{
			files: ["**/*.ts", "**/*.tsx"],
			excludeFiles: ["lib/env/env.client.ts", "lib/env/env.server.ts", "e2e/browser-env.e2e.ts"],
			rules: {
				"no-restricted-properties": [
					"error",
					{
						object: "process",
						property: "env",
						message:
							"Read configuration through the validated env modules (lib/env/env.client.ts / env.server.ts), never process.env directly. See docs/technical/configuration/frontend.md.",
					},
				],
			},
		},
		// The browser suite reads its own env (e2e/browser-env.e2e.ts, the same boundary as admin's); turbo.json does not list those keys.
		{
			files: ["e2e/**"],
			rules: { "turbo/no-undeclared-env-vars": "off" },
		},
	],
});
