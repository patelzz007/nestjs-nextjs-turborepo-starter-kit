import jsxA11y from "eslint-plugin-jsx-a11y";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

import { config as baseConfig } from "./base.js";

/**
 * A custom ESLint configuration for libraries that use React.
 * Used by packages/ui.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
	...baseConfig,

	// ── React strict rules ─────────────────────────────────────────────
	{
		...pluginReact.configs.flat.recommended,
		...pluginReact.configs.flat["jsx-runtime"],
		languageOptions: {
			...pluginReact.configs.flat.recommended.languageOptions,
			globals: {
				...globals.serviceworker,
				...globals.browser,
			},
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
				"warn",
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
			"react/no-array-index-key": "warn",
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
			...pluginReactHooks.configs.recommended.rules,
		},
	},

	// ── Accessibility rules ─────────────────────────────────────────────
	{
		...jsxA11y.flatConfigs.recommended,
		rules: {
			"jsx-a11y/click-events-have-key-events": "off",
			"jsx-a11y/no-static-element-interactions": "warn",
			"jsx-a11y/no-noninteractive-element-interactions": "warn",
			"jsx-a11y/alt-text": "error",
			"jsx-a11y/aria-role": ["error", { ignoreNonDom: true }],
		},
	},
];
