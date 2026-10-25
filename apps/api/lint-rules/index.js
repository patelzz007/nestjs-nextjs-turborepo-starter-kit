// ============================================
// lint-rules/index.js — apps/api's local oxlint JS plugin (`api/*` rules)
// ============================================
// Loaded by oxlint.config.ts through `jsPlugins`. Plain JavaScript: oxlint
// runs rules written against the ESLint plugin API, and a rule needs nothing beyond the AST.

import { noUnversionedController } from "./no-unversioned-controller.js";

const plugin = {
	meta: { name: "api" },
	rules: {
		"no-unversioned-controller": noUnversionedController,
	},
};

export default plugin;
