// jest-expo for the React Native UI kit — the same runner, preset and
// resolution rules as apps/mobile (ADR 031): React Native's transforms and
// native-module mocks are built for Jest, not Vitest.

const { transformIgnorePatterns: EXPO_TRANSFORM_IGNORE_PATTERNS } = require("jest-expo/jest-preset");

/**
 * Packages published as ES modules only (as in apps/mobile/jest.config.js). Metro bundles them as they are;
 * Jest runs CommonJS, so Babel compiles them like React Native's own packages: FormatJS, which formats the
 * translation catalogues' ICU messages (`formatMessage` in @workspace/shared).
 */
const ES_MODULE_ONLY_PACKAGES = ["intl-messageformat", "@formatjs"];

/** jest-expo's first pattern: skip node_modules except an allow-list, `(?!(a|b|…))`. */
const ALLOW_LIST_START = "/node_modules/(?!(";

function withEsModuleOnlyPackages(patterns) {
	const [allowList, ...rest] = patterns;
	if (allowList === undefined || !allowList.startsWith(ALLOW_LIST_START)) {
		throw new Error(`jest-expo's transformIgnorePatterns changed shape (${String(allowList)}): update jest.config.js`);
	}
	return [`${ALLOW_LIST_START}${ES_MODULE_ONLY_PACKAGES.join("|")}|${allowList.slice(ALLOW_LIST_START.length)}`, ...rest];
}

/** @type {import("jest").Config} */
module.exports = {
	// Coverage floors (enhancement 3.1): measured on 2026-11-03, set just below. Raise them as tests are
	// added; never lower them. `pnpm test` measures (`jest --coverage`).
	coverageReporters: ["text-summary"],
	coverageThreshold: { global: { lines: 97, statements: 97, functions: 96, branches: 91 } },
	preset: "jest-expo",
	resolver: "<rootDir>/jest.resolver.cjs",
	transformIgnorePatterns: withEsModuleOnlyPackages(EXPO_TRANSFORM_IGNORE_PATTERNS),
	setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
	moduleNameMapper: {
		// Uniwind compiles CSS in Metro; tests render without styles.
		"\\.css$": "<rootDir>/test/style-mock.cjs",
	},
	// Tests live in `__tests__/` folders beside the code they test (rules/11 → "Where tests live").
	testMatch: ["<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}"],
	clearMocks: true,
	restoreMocks: true,
};
