import { SOURCE_FILES } from "./base.js";
import { composeConfigs } from "./compose.js";
import { NEXT_PLUGIN } from "./js-plugins.js";
import { config as reactConfig } from "./react-internal.js";
import { nextRules } from "./rules/next.js";

/**
 * The oxlint configuration for the Next.js apps (apps/web, apps/admin,
 * apps/merchant). Everything React-related comes from `react-internal.js`, so
 * the Next apps and the React libraries cannot drift apart; only the Next.js
 * rules live here.
 */
export const nextJsConfig = composeConfigs(reactConfig, {
	plugins: ["nextjs"],
	jsPlugins: [NEXT_PLUGIN],
	overrides: [
		{
			files: SOURCE_FILES,
			rules: nextRules,
		},
	],
});
