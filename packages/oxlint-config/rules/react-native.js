/**
 * React Native rules (eslint-plugin-react-native, loaded as a JS plugin).
 *
 * Translated on 2026-10-25 from the rules ESLint 9 resolved for this repository
 * (js recommended, typescript-eslint strictTypeChecked + stylisticTypeChecked, the
 * plugin presets and the repository overrides), each mapped to its oxlint name with
 * its options unchanged. This file is now the source of truth: edit it directly.
 * Every rule is an error (rules/00); `__tests__/configs.test.js` fails on a `warn`.
 */

/** @type {import("oxlint").OxlintConfig["rules"]} */
export const reactNativeRules = {
	"react-native/no-color-literals": "error",
	"react-native/no-inline-styles": "error",
	"react-native/no-raw-text": ["error", { skip: ["Heading", "Subheading", "BodyText", "MutedText", "Label", "ErrorText"] }],
	"react-native/no-single-element-style-arrays": "error",
	"react-native/no-unused-styles": "error",
	"react-native/split-platform-components": "error",
};
