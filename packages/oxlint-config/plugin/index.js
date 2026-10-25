/**
 * The repository's own oxlint JS plugin (`workspace/*` rules).
 *
 * Oxlint runs ESLint-API rules through `jsPlugins`; these are the rules oxlint
 * has no native equivalent for, or (restricted-imports) whose native version
 * would weaken a boundary. Every config in this package loads the plugin as
 * `@workspace/oxlint-config/plugin`. Each rule is covered by a RuleTester
 * suite in `__tests__/plugin-*.test.js`.
 */

import namingConvention from "./naming-convention.js";
import noServerImportInClientComponent from "./no-server-import-in-client-component.js";
import restrictedImports from "./restricted-imports.js";
import restrictedSyntax from "./restricted-syntax.js";
import ssrFalseAllowlist from "./ssr-false-allowlist.js";

const plugin = {
	meta: { name: "workspace" },
	rules: {
		"naming-convention": namingConvention,
		"no-server-import-in-client-component": noServerImportInClientComponent,
		"restricted-imports": restrictedImports,
		"restricted-syntax": restrictedSyntax,
		"ssr-false-allowlist": ssrFalseAllowlist,
	},
};

export default plugin;
