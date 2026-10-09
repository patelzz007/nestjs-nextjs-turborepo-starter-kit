import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";

import { withErrorSeverity } from "./rule-severity.js";

/**
 * The React rule blocks every React config shares — the web libraries
 * (`react-internal.js`, and through it `next.js`) and the React Native app
 * (`react-native.js`) — so the platforms can never drift apart. Only the
 * runtime globals differ: the browser's for the web, React Native's for mobile.
 *
 * @param {Record<string, boolean | "readonly" | "writable" | "off">} runtimeGlobals
 * @returns {import("eslint").Linter.Config[]}
 */
export function reactRuleBlocks(runtimeGlobals) {
	return [
		// ── React strict rules ─────────────────────────────────────────────
		{
			...pluginReact.configs.flat.recommended,
			// Merge the two presets' rules explicitly: spreading both objects would let
			// jsx-runtime's `rules` (2 entries) replace recommended's (22 entries).
			rules: withErrorSeverity({
				...pluginReact.configs.flat.recommended.rules,
				...pluginReact.configs.flat["jsx-runtime"].rules,
			}),
			languageOptions: {
				...pluginReact.configs.flat.recommended.languageOptions,
				globals: runtimeGlobals,
			},
			settings: {
				react: {
					version: "detect",
				},
			},
		},

		// ── Additional React rules ──────────────────────────────────────────
		{
			rules: {
				"react/jsx-no-leaked-render": ["error", { validStrategies: ["ternary"] }],
				"react/jsx-no-bind": [
					"error",
					{
						ignoreDOMComponents: false,
						ignoreRefs: false,
						allowFunctions: true,
						allowArrowFunctions: false,
					},
				],
				"react/jsx-boolean-value": ["error", "never"],
				"react/jsx-key": ["error", { checkFragmentShorthand: true }],
				"react/no-unstable-nested-components": ["error", { allowAsProps: true }],
				"react/no-array-index-key": "error",
				"react/react-in-jsx-scope": "off",
				"react/prop-types": "off",
			},
		},

		// ── React Hooks rules ───────────────────────────────────────────────
		{
			plugins: {
				"react-hooks": pluginReactHooks,
			},
			rules: {
				...withErrorSeverity(pluginReactHooks.configs.recommended.rules),
			},
		},
	];
}
