import pluginNext from "@next/eslint-plugin-next";

import { config as reactConfig } from "./react-internal.js";
import { withErrorSeverity } from "./rule-severity.js";

/**
 * A custom ESLint configuration for Next.js applications (apps/web, apps/admin, apps/merchant).
 *
 * Everything React-related (strict React rules, hooks, accessibility, frontend
 * import boundaries) comes from `react-internal.js`, so the Next apps and the
 * React libraries can never drift apart. Only the Next-specific additions live here.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const nextJsConfig = [
	...reactConfig,

	// ── Additional React rules (Next apps only) ─────────────────────────
	{
		rules: {
			// Require default props in components
			"react/require-default-props": "off", // TypeScript handles this
		},
	},

	// ── Next.js rules ───────────────────────────────────────────────────
	{
		plugins: {
			"@next/next": pluginNext,
		},
		rules: {
			...withErrorSeverity({
				...pluginNext.configs.recommended.rules,
				...pluginNext.configs["core-web-vitals"].rules,
			}),
		},
	},
];
