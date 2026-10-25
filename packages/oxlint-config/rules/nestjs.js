/**
 * NestJS rules from @darraghor/eslint-plugin-nestjs-typed, loaded as a JS plugin.
 * Three of its rules need typescript-eslint parser services and cannot run under
 * oxlint; see docs/technical/tooling/oxlint.md, "Known gaps".
 *
 * Translated on 2026-10-25 from the rules ESLint 9 resolved for this repository
 * (js recommended, typescript-eslint strictTypeChecked + stylisticTypeChecked, the
 * plugin presets and the repository overrides), each mapped to its oxlint name with
 * its options unchanged. This file is now the source of truth: edit it directly.
 * Every rule is an error (rules/00); `__tests__/configs.test.js` fails on a `warn`.
 */

/** @type {import("oxlint").OxlintConfig["rules"]} */
export const nestjsRules = {
	"nestjs/all-properties-are-whitelisted": "error",
	"nestjs/api-method-should-specify-api-response": [
		"error",
		{ additionalCustomApiResponseDecorators: ["ZodResponse", "ZodPaginatedResponse", "ZodRawResponse", "ZodFileResponse"] },
	],
	"nestjs/api-operation-summary-description-capitalized": "error",
	"nestjs/api-property-matches-property-optionality": "error",
	"nestjs/api-property-returning-array-should-set-array": "error",
	"nestjs/api-property-should-have-api-extra-models": "error",
	"nestjs/controllers-should-supply-api-tags": "error",
	"nestjs/forward-ref-injection-should-use-wrapper-type": "error",
	"nestjs/injectable-should-be-provided": ["error", { src: ["src/**/*.ts"], filterFromPaths: ["node_modules", ".test.", ".spec."] }],
	"nestjs/no-duplicate-decorators": "error",
	"nestjs/param-decorator-name-matches-route-param": "error",
	"nestjs/provided-injected-should-match-factory-parameters": "error",
	"nestjs/swagger-file-upload-should-be-documented": "error",
	"nestjs/uploaded-file-should-be-validated": "error",
	"nestjs/use-injectable-provided-token": "error",
	"nestjs/validate-nested-of-array-should-set-each": "error",
	"nestjs/validation-pipe-should-use-forbid-unknown": "error",
};
