import pluginReactNative from "eslint-plugin-react-native";

import { config as baseConfig } from "./base.js";
import { mobileImportBoundaryConfig } from "./import-boundaries.js";
import { reactRuleBlocks } from "./react-rules.js";
import { restrictedSyntaxRules } from "./restricted-syntax-rules.js";

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
 * has no React Native rules). Expressed as `no-restricted-syntax` selectors, so
 * they join the base selectors in ONE rule entry (a later block replaces an
 * earlier block's options).
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
 * ESLint configuration for the React Native app (apps/mobile): the same strict
 * TypeScript rules as every workspace (no casts, no runtime `typeof`, explicit
 * return types and access modifiers — base.js), the shared React and hooks
 * rules with React Native globals, React Native rules (no raw text outside
 * <Text>, no inline styles or colour literals — tokens only), accessibility
 * selectors, and the mobile import boundaries (no next, react-dom, web
 * packages, Node built-ins or AsyncStorage).
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
	...baseConfig,

	// ── React, React rules and React Hooks (shared with react-internal.js) ──
	...reactRuleBlocks(REACT_NATIVE_GLOBALS),

	// ── React Native rules ──────────────────────────────────────────────
	{
		plugins: {
			"react-native": pluginReactNative,
		},
		rules: {
			// A string outside <Text> crashes React Native at runtime. Apps list their own text
			// components with `skip` when they wrap <Text> (see apps/mobile/eslint.config.js).
			"react-native/no-raw-text": "error",
			// Styling comes from the generated design tokens through Uniwind classes (ADR 030, 032).
			"react-native/no-inline-styles": "error",
			"react-native/no-color-literals": "error",
			"react-native/no-unused-styles": "error",
			"react-native/no-single-element-style-arrays": "error",
			"react-native/split-platform-components": "error",
		},
	},

	// ── Accessibility (React Native) + the base restricted-syntax selectors ──
	{
		files: ["**/*.tsx", "**/*.jsx"],
		rules: {
			"no-restricted-syntax": [...restrictedSyntaxRules, ...REACT_NATIVE_ACCESSIBILITY_SELECTORS],
		},
	},

	// ── Import boundaries (mobile) ──────────────────────────────────────
	mobileImportBoundaryConfig,
];
