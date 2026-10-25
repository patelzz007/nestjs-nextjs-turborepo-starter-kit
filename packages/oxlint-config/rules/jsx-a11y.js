/**
 * Accessibility rules for DOM JSX (web only; React Native uses its own selectors).
 * `aria-role` keeps `ignoreNonDOM: false`, the value ESLint actually applied: the old
 * config spelled the option `ignoreNonDom`, which the plugin never read.
 * `jsx-a11y-js/*` run through eslint-plugin-jsx-a11y itself (JS plugin): oxlint's native
 * `aria-role` rejects `role={undefined}` and native `interactive-supports-focus` ignores
 * the `tabbable` option — both reported valid code the reference plugin accepts.
 *
 * Translated on 2026-10-25 from the rules ESLint 9 resolved for this repository
 * (js recommended, typescript-eslint strictTypeChecked + stylisticTypeChecked, the
 * plugin presets and the repository overrides), each mapped to its oxlint name with
 * its options unchanged. This file is now the source of truth: edit it directly.
 * Every rule is an error (rules/00); `__tests__/configs.test.js` fails on a `warn`.
 */

/** @type {import("oxlint").OxlintConfig["rules"]} */
export const jsxA11yRules = {
	"jsx-a11y-js/aria-role": ["error", { ignoreNonDOM: false }],
	"jsx-a11y-js/interactive-supports-focus": ["error", { tabbable: ["button", "checkbox", "link", "searchbox", "spinbutton", "switch", "textbox"] }],
	"jsx-a11y/alt-text": "error",
	"jsx-a11y/anchor-has-content": "error",
	"jsx-a11y/anchor-is-valid": "error",
	"jsx-a11y/aria-activedescendant-has-tabindex": "error",
	"jsx-a11y/aria-props": "error",
	"jsx-a11y/aria-proptypes": "error",
	"jsx-a11y/aria-unsupported-elements": "error",
	"jsx-a11y/autocomplete-valid": "error",
	"jsx-a11y/heading-has-content": "error",
	"jsx-a11y/html-has-lang": "error",
	"jsx-a11y/iframe-has-title": "error",
	"jsx-a11y/img-redundant-alt": "error",
	"jsx-a11y/label-has-associated-control": "error",
	"jsx-a11y/media-has-caption": "error",
	"jsx-a11y/mouse-events-have-key-events": "error",
	"jsx-a11y/no-access-key": "error",
	"jsx-a11y/no-autofocus": "error",
	"jsx-a11y/no-distracting-elements": "error",
	"jsx-a11y/no-interactive-element-to-noninteractive-role": ["error", { tr: ["none", "presentation"], canvas: ["img"] }],
	"jsx-a11y/no-noninteractive-element-interactions": "error",
	"jsx-a11y/no-noninteractive-element-to-interactive-role": [
		"error",
		{
			ul: ["listbox", "menu", "menubar", "radiogroup", "tablist", "tree", "treegrid"],
			ol: ["listbox", "menu", "menubar", "radiogroup", "tablist", "tree", "treegrid"],
			li: ["menuitem", "menuitemradio", "menuitemcheckbox", "option", "row", "tab", "treeitem"],
			table: ["grid"],
			td: ["gridcell"],
			fieldset: ["radiogroup", "presentation"],
		},
	],
	"jsx-a11y/no-noninteractive-tabindex": ["error", { tags: [], roles: ["tabpanel"], allowExpressionValues: true }],
	"jsx-a11y/no-redundant-roles": "error",
	"jsx-a11y/no-static-element-interactions": "error",
	"jsx-a11y/role-has-required-aria-props": "error",
	"jsx-a11y/role-supports-aria-props": "error",
	"jsx-a11y/scope": "error",
	"jsx-a11y/tabindex-no-positive": "error",
};
