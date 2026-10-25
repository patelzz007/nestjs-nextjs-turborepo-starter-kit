import { composeConfigs } from "@workspace/oxlint-config/compose";
import { config } from "@workspace/oxlint-config/react-native";

/**
 * apps/mobile — the Expo app. Everything comes from the shared React Native
 * config; this file adds the app's text components (they render children inside
 * <Text>) and the env boundary: `process.env` is read ONLY by src/lib/env.ts, which
 * validates it with zod (Metro inlines EXPO_PUBLIC_* at build time, and only for
 * literal `process.env.EXPO_PUBLIC_…` reads).
 */
export default composeConfigs(config, {
	overrides: [
		{
			files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
			rules: { "react-native/no-raw-text": ["error", { skip: ["Heading", "Subheading", "BodyText", "MutedText", "Label", "ErrorText"] }] },
		},
		{
			files: ["**/*.ts", "**/*.tsx"],
			excludeFiles: ["src/lib/env.ts"],
			rules: {
				"no-restricted-properties": [
					"error",
					{
						object: "process",
						property: "env",
						message: "Read configuration through the validated env module (src/lib/env.ts), never process.env directly. See docs/technical/configuration/frontend.md.",
					},
				],
			},
		},
	],
});
