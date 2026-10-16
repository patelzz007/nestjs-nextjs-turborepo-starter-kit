// jest-expo for the mobile app (ADR 031): the one exception to the repo-wide
// Vitest standard. Platform-neutral logic is tested with Vitest in the shared
// packages; these suites cover screens, hooks and mobile-only modules.

/** @type {import("jest").Config} */
module.exports = {
	preset: "jest-expo",
	// Same resolution rules as Metro (metro.config.js): React / React Native /
	// TanStack Query are singletons from this app, and @workspace/* resolve
	// through their `development` export (TypeScript source).
	resolver: "<rootDir>/jest.resolver.cjs",
	setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
	moduleNameMapper: {
		// Uniwind compiles CSS in Metro; tests render without styles.
		"\\.css$": "<rootDir>/test/style-mock.cjs",
	},
	// Tests live in `__tests__/` folders beside the code they test (rules/11 →
	// "Where tests live"); the route screens' tests in src/__tests__/app/ (never
	// inside src/app/: Expo Router bundles every file there). test/ holds the
	// shared test helpers, with their own tests in test/__tests__/.
	testMatch: ["<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}", "<rootDir>/test/__tests__/**/*.test.ts"],
	clearMocks: true,
	restoreMocks: true,
};
