import { composeConfigs } from "@workspace/oxlint-config/compose";
import { config } from "@workspace/oxlint-config/react-native";

/** packages/ui-native: the React Native rules; its text components render their children inside <Text>. */
export default composeConfigs(config, {
	overrides: [
		{
			files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
			rules: { "react-native/no-raw-text": ["error", { skip: ["Heading", "Subheading", "BodyText", "MutedText", "Label", "ErrorText"] }] },
		},
	],
});
