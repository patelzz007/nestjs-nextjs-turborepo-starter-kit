import pluginNext from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

import { config as baseConfig } from "./base.js";

/**
 * A custom ESLint configuration for Next.js applications (apps/web, apps/admin).
 *
 * @type {import("eslint").Linter.Config}
 * */
export const nextJsConfig = [
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
			// Prevent conditional rendering bugs: {count && ...} vs {!!count && ...}
			"react/jsx-no-leaked-render": ["error", { validStrategies: ["ternary"] }],

			// Prevent inline arrow functions in JSX (re-render performance)
			"react/jsx-no-bind": [
				"warn",
				{
					ignoreDOMComponents: false,
					ignoreRefs: false,
					allowFunctions: true,
					allowArrowFunctions: false,
				},
			],

			// Enforce boolean attributes notation
			"react/jsx-boolean-value": ["error", "never"],

			// No missing key props in iterators
			"react/jsx-key": ["error", { checkFragmentShorthand: true }],

			// No unstable components
			"react/no-unstable-nested-components": ["error", { allowAsProps: true }],

			// Prevent using Array index as key
			"react/no-array-index-key": "warn",

			// Require default props in components
			"react/require-default-props": "off", // TypeScript handles this

			// React scope no longer necessary with new JSX transform
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
			// Allow focusable elements without keyboard listener when click handler exists
			"jsx-a11y/click-events-have-key-events": "off",
			"jsx-a11y/no-static-element-interactions": "warn",

			// Allow non-interactive elements with role and tabIndex
			"jsx-a11y/no-noninteractive-element-interactions": "warn",

			// Enforce alt text on images
			"jsx-a11y/alt-text": "error",

			// Enformce ARIA roles
			"jsx-a11y/aria-role": ["error", { ignoreNonDom: true }],
		},
	},

	// ── Next.js rules ───────────────────────────────────────────────────
	{
		plugins: {
			"@next/next": pluginNext,
		},
		rules: {
			...pluginNext.configs.recommended.rules,
			...pluginNext.configs["core-web-vitals"].rules,
		},
	},
];
