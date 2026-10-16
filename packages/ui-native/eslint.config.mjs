import { config } from "@workspace/eslint-config/react-native";

/**
 * packages/ui-native — the React Native UI kit. Everything comes from the
 * shared React Native config (packages/eslint-config/react-native.js); this
 * file only adds what is specific to the kit.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
	...config,
	{
		// The kit's text roles render their children inside <Text>.
		rules: {
			"react-native/no-raw-text": ["error", { skip: ["Heading", "Subheading", "BodyText", "MutedText", "Label", "ErrorText"] }],
		},
	},
];
