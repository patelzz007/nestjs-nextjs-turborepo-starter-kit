import { composeConfigs } from "@workspace/oxlint-config/compose";
import { config } from "@workspace/oxlint-config/react-native";

/**
 * apps/mobile — the Expo app. Everything comes from the shared React Native
 * config; this file adds the app's text components (they render children inside
 * <Text>) and the env boundary: `process.env` is read ONLY by src/lib/env.ts (the app's
 * configuration: Metro inlines EXPO_PUBLIC_* at build time, and only for literal
 * `process.env.EXPO_PUBLIC_…` reads) and by build-env/app-config-env.ts (the build's, which
 * app.config.ts reads on the build machine). Both validate it with zod.
 */
export default composeConfigs(config, {
	overrides: [
		// Maestro's own scripts (.maestro/**/*.js, `runScript`) run in Maestro's JavaScript engine, which provides
		// `output` (what the flow reads back), `http` and `json`, and each `env:` value as a global of that name.
		{
			files: [".maestro/**/*.js"],
			globals: { output: "writable", http: "readonly", json: "readonly", MAILPIT_URL: "readonly", REQUESTED_AT: "readonly" },
		},
		{
			files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
			rules: { "react-native/no-raw-text": ["error", { skip: ["Heading", "Subheading", "BodyText", "MutedText", "Label", "ErrorText"] }] },
		},
		{
			files: ["**/*.ts", "**/*.tsx"],
			excludeFiles: ["src/lib/env.ts", "build-env/app-config-env.ts"],
			rules: {
				"no-restricted-properties": [
					"error",
					{
						object: "process",
						property: "env",
						message:
							"Read configuration through the validated env modules (src/lib/env.ts in the app, build-env/app-config-env.ts for app.config.ts), never process.env directly. See docs/technical/configuration/frontend.md.",
					},
				],
			},
		},
	],
});
