/**
 * React, React Hooks and React Compiler rules, shared by the web (react-internal.js,
 * next.js) and React Native (react-native.js) configs so the platforms cannot drift.
 * `react-js/*` are eslint-plugin-react rules oxlint has no native version of (JS plugin).
 * `react-hooks-js/*` are the React Compiler rules, run by eslint-plugin-react-hooks itself
 * (JS plugin): oxlint's native ports reported 49 findings across ui, ui-native, admin,
 * merchant and web that the reference React Compiler does not (verified 2026-10-25), so
 * the reference implementation stays the source of truth. `react/rules-of-hooks` and
 * `react/exhaustive-deps` are native (they match).
 *
 * Translated on 2026-10-25 from the rules ESLint 9 resolved for this repository
 * (js recommended, typescript-eslint strictTypeChecked + stylisticTypeChecked, the
 * plugin presets and the repository overrides), each mapped to its oxlint name with
 * its options unchanged. This file is now the source of truth: edit it directly.
 * Every rule is an error (rules/00); `__tests__/configs.test.js` fails on a `warn`.
 */

/** @type {import("oxlint").OxlintConfig["rules"]} */
export const reactRules = {
	"react-hooks-js/config": "error",
	"react-hooks-js/error-boundaries": "error",
	"react-hooks-js/gating": "error",
	"react-hooks-js/globals": "error",
	"react-hooks-js/immutability": "error",
	"react-hooks-js/incompatible-library": "error",
	"react-hooks-js/preserve-manual-memoization": "error",
	"react-hooks-js/purity": "error",
	"react-hooks-js/refs": "error",
	"react-hooks-js/set-state-in-effect": "error",
	"react-hooks-js/set-state-in-render": "error",
	"react-hooks-js/static-components": "error",
	"react-hooks-js/unsupported-syntax": "error",
	"react-hooks-js/use-memo": "error",
	"react-js/jsx-no-bind": ["error", { ignoreDOMComponents: false, ignoreRefs: false, allowFunctions: true, allowArrowFunctions: false, allowBind: false }],
	"react-js/jsx-no-leaked-render": ["error", { validStrategies: ["ternary"] }],
	"react-js/no-deprecated": "error",
	"react/display-name": "error",
	"react/exhaustive-deps": "error",
	"react/jsx-boolean-value": ["error", "never"],
	"react/jsx-key": ["error", { checkFragmentShorthand: true, checkKeyMustBeforeSpread: false, warnOnDuplicates: false }],
	"react/jsx-no-comment-textnodes": "error",
	"react/jsx-no-duplicate-props": "error",
	"react/jsx-no-target-blank": "error",
	"react/jsx-no-undef": "error",
	"react/no-array-index-key": "error",
	"react/no-children-prop": "error",
	"react/no-danger-with-children": "error",
	"react/no-direct-mutation-state": "error",
	"react/no-find-dom-node": "error",
	"react/no-is-mounted": "error",
	"react/no-render-return-value": "error",
	"react/no-string-refs": "error",
	"react/no-unescaped-entities": "error",
	"react/no-unknown-property": "error",
	"react/no-unstable-nested-components": ["error", { allowAsProps: true }],
	"react/require-render-return": "error",
	"react/rules-of-hooks": "error",
};
