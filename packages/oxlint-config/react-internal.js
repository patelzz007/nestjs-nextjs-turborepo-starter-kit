import { config as baseConfig, SOURCE_FILES } from "./base.js";
import { composeConfigs } from "./compose.js";
import { frontendContextBoundaryConfigs, frontendImportBoundaryConfig } from "./import-boundaries.js";
import { JSX_A11Y_PLUGIN, REACT_HOOKS_PLUGIN, REACT_PLUGIN } from "./js-plugins.js";
import { installedReactVersion } from "./react-version.js";
import { jsxA11yRules } from "./rules/jsx-a11y.js";
import { reactRules } from "./rules/react.js";

/**
 * The approved rule exceptions: each a single file and the exact rules it may
 * break, approved by a maintainer. This list is the only sanctioned place to
 * relax a rule (no inline `oxlint-disable` / `eslint-disable`), and
 * `__tests__/configs.test.js` pins its contents so nothing is added silently.
 *
 * - `signature-pad.tsx`: the drawing area is a focusable `role="application"`
 *   with undo / redo shortcuts (WAI-ARIA allows focus and key handling on
 *   `application`), but jsx-a11y classifies that role as non-interactive.
 *   Approved 2026-10-16 as the only exception for now.
 */
export const approvedRuleExceptions = [
	{
		files: ["src/components/signature-pad.tsx"],
		rules: {
			"jsx-a11y/no-noninteractive-element-interactions": "off",
			"jsx-a11y/no-noninteractive-tabindex": "off",
		},
	},
];

/**
 * The client-only widget allowlist (decision #58): `next/dynamic(..., { ssr:
 * false })` only in an allowlisted `*.client-only.tsx` wrapper. The shared
 * configs turn it on with an empty list, which fails closed; a workspace that
 * renders the widgets passes `CLIENT_ONLY_WIDGETS` from
 * `@workspace/ui/lib/client-only-widgets`.
 *
 * @param {readonly string[]} widgets
 */
export function clientOnlyWidgetsConfig(widgets) {
	return {
		files: SOURCE_FILES,
		rules: {
			"workspace/ssr-false-allowlist": ["error", { widgets: [...widgets] }],
		},
	};
}

/**
 * The oxlint configuration for React libraries (packages/ui, packages/client,
 * packages/api-client), and through `next.js` the Next apps: base, the React /
 * Hooks / Compiler rules shared with React Native, DOM accessibility, the
 * frontend import boundaries and the client-only widget allowlist.
 */
export const config = composeConfigs(baseConfig, {
	plugins: ["react", "jsx-a11y"],
	jsPlugins: [REACT_PLUGIN, REACT_HOOKS_PLUGIN, JSX_A11Y_PLUGIN],
	env: {
		browser: true,
		serviceworker: true,
	},
	settings: {
		react: { version: installedReactVersion() },
	},
	overrides: [
		{
			files: SOURCE_FILES,
			rules: { ...reactRules, ...jsxA11yRules },
		},
		frontendImportBoundaryConfig,
		...frontendContextBoundaryConfigs,
		clientOnlyWidgetsConfig([]),
		...approvedRuleExceptions,
	],
});
