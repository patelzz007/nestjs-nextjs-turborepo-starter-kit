import globals from "globals";

import { config as baseConfig } from "./base.js";

/**
 * The shared configs lint themselves with the base config, so a typo or an
 * unused import in a rule file fails the gate like any other code.
 *
 * @type {import("eslint").Linter.Config}
 */
export default [
	...baseConfig,
	{
		// ESLint loads these modules on Node; the tests run on Node too.
		files: ["**/*.js"],
		languageOptions: {
			globals: globals.node,
		},
	},
];
