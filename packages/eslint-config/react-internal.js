import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

import { config as baseConfig } from "./base.js";
import { frontendImportBoundaryConfig } from "./import-boundaries.js";
import { reactRuleBlocks } from "./react-rules.js";
import { withErrorSeverity } from "./rule-severity.js";

/**
 * A custom ESLint configuration for libraries that use React.
 * Used by packages/ui.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
	...baseConfig,

	// ── React, React rules and React Hooks (shared with react-native.js) ──
	...reactRuleBlocks({
		...globals.serviceworker,
		...globals.browser,
	}),

	// ── Import boundaries (frontend) ────────────────────────────────────
	// Same browser-safety boundaries as the Next apps (see docs/technical/tooling/eslint.md).
	frontendImportBoundaryConfig,

	// ── Accessibility rules ─────────────────────────────────────────────
	{
		...jsxA11y.flatConfigs.recommended,
		// Keep the preset's rules: a bare `rules: {}` here would replace them all.
		rules: {
			...withErrorSeverity(jsxA11y.flatConfigs.recommended.rules),
			"jsx-a11y/click-events-have-key-events": "off",
			"jsx-a11y/no-static-element-interactions": "error",
			"jsx-a11y/no-noninteractive-element-interactions": "error",
			"jsx-a11y/alt-text": "error",
			"jsx-a11y/aria-role": ["error", { ignoreNonDom: true }],
		},
	},
];
