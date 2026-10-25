/**
 * Next.js rules (recommended + core-web-vitals). `next-js/*` comes from
 * @next/eslint-plugin-next as a JS plugin (no native oxlint version yet).
 *
 * Translated on 2026-10-25 from the rules ESLint 9 resolved for this repository
 * (js recommended, typescript-eslint strictTypeChecked + stylisticTypeChecked, the
 * plugin presets and the repository overrides), each mapped to its oxlint name with
 * its options unchanged. This file is now the source of truth: edit it directly.
 * Every rule is an error (rules/00); `__tests__/configs.test.js` fails on a `warn`.
 */

/** @type {import("oxlint").OxlintConfig["rules"]} */
export const nextRules = {
	"next-js/no-location-assign-relative-destination": "error",
	"nextjs/google-font-display": "error",
	"nextjs/google-font-preconnect": "error",
	"nextjs/inline-script-id": "error",
	"nextjs/next-script-for-ga": "error",
	"nextjs/no-assign-module-variable": "error",
	"nextjs/no-async-client-component": "error",
	"nextjs/no-before-interactive-script-outside-document": "error",
	"nextjs/no-css-tags": "error",
	"nextjs/no-document-import-in-page": "error",
	"nextjs/no-duplicate-head": "error",
	"nextjs/no-head-element": "error",
	"nextjs/no-head-import-in-document": "error",
	"nextjs/no-html-link-for-pages": "error",
	"nextjs/no-img-element": "error",
	"nextjs/no-page-custom-font": "error",
	"nextjs/no-script-component-in-head": "error",
	"nextjs/no-styled-jsx-in-document": "error",
	"nextjs/no-sync-scripts": "error",
	"nextjs/no-title-in-document-head": "error",
	"nextjs/no-typos": "error",
	"nextjs/no-unwanted-polyfillio": "error",
};
