import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

import { config as baseConfig } from "./base.js";
import { frontendImportBoundaryConfig } from "./import-boundaries.js";
import { reactRuleBlocks } from "./react-rules.js";
import { withErrorSeverity } from "./rule-severity.js";

/**
 * The approved rule exceptions: each a single file and the exact rules it may
 * break, approved by a maintainer. This list is the only sanctioned place to
 * relax a rule (no inline `eslint-disable`), and `tests/configs.test.js`
 * pins its contents so nothing is added silently.
 *
 * - `signature-pad.tsx`: the drawing area is a focusable `role="application"`
 *   with undo / redo shortcuts (WAI-ARIA allows focus and key handling on
 *   `application`), but jsx-a11y classifies that role as non-interactive.
 *   Approved 2026-10-16 as the only exception for now.
 *
 * @type {readonly import("eslint").Linter.Config[]}
 */
export const approvedRuleExceptions = [
	{
		name: "approved-exception/signature-pad-application-role",
		files: ["src/components/signature-pad.tsx"],
		rules: {
			"jsx-a11y/no-noninteractive-element-interactions": "off",
			"jsx-a11y/no-noninteractive-tabindex": "off",
		},
	},
];

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

	// ── Approved exceptions (last, so they apply over the blocks above) ──
	...approvedRuleExceptions,
];
