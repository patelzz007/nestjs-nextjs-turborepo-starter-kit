import { config } from "@workspace/eslint-config/react-native";

/**
 * apps/mobile — the Expo app. Everything comes from the shared React Native
 * config (packages/eslint-config/react-native.js); this file only adds what is
 * specific to this app.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
	...config,
	{
		// The app's own components that render their children inside <Text>.
		rules: {
			"react-native/no-raw-text": ["error", { skip: ["Heading", "Subheading", "BodyText", "MutedText", "Label", "ErrorText"] }],
		},
	},
	{
		// ── Env boundary (docs/technical/configuration/frontend.md) ──────────
		// `process.env` is read ONLY by src/lib/env.ts, which validates it with zod
		// (Metro inlines EXPO_PUBLIC_* at build time, and only for literal
		// `process.env.EXPO_PUBLIC_…` reads). Everything else imports the parsed env.
		files: ["**/*.ts", "**/*.tsx"],
		ignores: ["src/lib/env.ts"],
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
];
