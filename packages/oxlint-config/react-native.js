import { config as baseConfig, SOURCE_FILES } from "./base.js";
import { composeConfigs } from "./compose.js";
import { mobileContextBoundaryConfigs, mobileImportBoundaryConfig } from "./import-boundaries.js";
import { REACT_HOOKS_PLUGIN, REACT_NATIVE_PLUGIN, REACT_PLUGIN } from "./js-plugins.js";
import { installedReactVersion } from "./react-version.js";
import { restrictedSyntaxRules } from "./restricted-syntax-rules.js";
import { reactNativeRules } from "./rules/react-native.js";
import { reactRules } from "./rules/react.js";

/**
 * The globals React Native (Hermes) provides, instead of `globals.browser`
 * (docs/technical/mobile/mobile-app.md §9.8). TypeScript files are checked by
 * the compiler; these matter for plain JS files.
 *
 * @type {Record<string, "readonly">}
 */
export const REACT_NATIVE_GLOBALS = Object.fromEntries(
	[
		"__DEV__",
		"AbortController",
		"AbortSignal",
		"alert",
		"atob",
		"btoa",
		"cancelAnimationFrame",
		"cancelIdleCallback",
		"clearImmediate",
		"clearInterval",
		"clearTimeout",
		"console",
		"fetch",
		"FileReader",
		"FormData",
		"global",
		"globalThis",
		"Headers",
		"navigator",
		"performance",
		"process",
		"queueMicrotask",
		"requestAnimationFrame",
		"requestIdleCallback",
		"Request",
		"require",
		"Response",
		"setImmediate",
		"setInterval",
		"setTimeout",
		"structuredClone",
		"TextDecoder",
		"TextEncoder",
		"URL",
		"URLSearchParams",
		"WebSocket",
		"window",
		"XMLHttpRequest",
	].map((name) => [name, "readonly"]),
);

/** Touchable / pressable components: what a screen reader announces as a control. */
const PRESSABLE_COMPONENT_PATTERN = "/^(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|TouchableNativeFeedback)$/";

/**
 * Accessibility checks React Native needs (jsx-a11y targets DOM elements and
 * has no React Native rules). Expressed as esquery selectors, so
 * they join the base selectors in ONE `workspace/restricted-syntax` entry (a
 * later override replaces an earlier one's options).
 */
export const REACT_NATIVE_ACCESSIBILITY_SELECTORS = [
	{
		selector: `JSXOpeningElement[name.name=${PRESSABLE_COMPONENT_PATTERN}]:not(:has(JSXAttribute[name.name=/^(accessibilityRole|role)$/]))`,
		message: "A pressable needs `accessibilityRole` (button, link, checkbox, radio, …) so screen readers announce it as a control (rules/04-mobile-expo.md, Accessibility).",
	},
	{
		selector: `JSXOpeningElement[name.name=${PRESSABLE_COMPONENT_PATTERN}]:not(:has(JSXAttribute[name.name=/^(accessibilityLabel|aria-label|aria-labelledby|accessibilityLabelledBy)$/]))`,
		message: "A pressable needs `accessibilityLabel` (what it does) so screen readers can name it (rules/04-mobile-expo.md, Accessibility).",
	},
	{
		selector: "JSXOpeningElement[name.name='TextInput']:not(:has(JSXAttribute[name.name=/^(accessibilityLabel|aria-label|aria-labelledby|accessibilityLabelledBy)$/]))",
		message: "A TextInput needs `accessibilityLabel` (or `aria-labelledby`) naming the field for screen readers (rules/04-mobile-expo.md, Accessibility).",
	},
	{
		selector:
			"JSXOpeningElement[name.name='Image']:not(:has(JSXAttribute[name.name=/^(accessibilityLabel|aria-label|alt|accessible|accessibilityElementsHidden|importantForAccessibility)$/]))",
		message: "An Image needs `accessibilityLabel` (or `alt`), or must be hidden from screen readers when decorative (rules/04-mobile-expo.md, Accessibility).",
	},
];

/**
 * The oxlint configuration for the React Native app (apps/mobile) and
 * packages/ui-native: the same strict TypeScript rules as every workspace
 * (base.js), the React / Hooks / Compiler rules shared with the web, React
 * Native rules (no raw text outside <Text>, no inline styles or colour literals
 * — tokens only), accessibility selectors, and the mobile import boundaries (no
 * next, react-dom, web packages, Node built-ins or AsyncStorage).
 */
export const config = composeConfigs(baseConfig, {
	plugins: ["react"],
	jsPlugins: [REACT_PLUGIN, REACT_HOOKS_PLUGIN, REACT_NATIVE_PLUGIN],
	globals: REACT_NATIVE_GLOBALS,
	settings: {
		react: { version: installedReactVersion() },
	},
	overrides: [
		{
			files: SOURCE_FILES,
			rules: { ...reactRules, ...reactNativeRules },
		},
		{
			files: ["**/*.tsx", "**/*.jsx"],
			rules: {
				"workspace/restricted-syntax": [...restrictedSyntaxRules, ...REACT_NATIVE_ACCESSIBILITY_SELECTORS],
			},
		},
		mobileImportBoundaryConfig,
		...mobileContextBoundaryConfigs,
	],
});
